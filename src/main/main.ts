import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } from 'electron';
import { registerUpdates } from './updates';
import log from 'electron-log';
import * as path from 'path';
import Store from 'electron-store';
import {
  IPC_CHANNELS,
  AppConfig,
  DownloadConfig,
  NetworkPathDefaults,
  UserSettings,
  SqlConnectionTestRequest,
  SqlCredentialIdentity,
  SqlPasswordDeleteRequest,
  SqlPasswordSaveRequest,
  SqlLoadRequest,
  SqlPreviewRequest,
} from '@/shared/types';
import { getSheetNames, loadSheetData } from '@/services/excelService';
import { DownloadService } from '@/services/downloadService';
import { CONSTANTS } from '@/shared/constants';
import { SqlServerService } from '@/services/SqlServerService';
import { SqlCredentialService } from '@/services/SqlCredentialService';
import { ValidationService } from '@/services/ValidationService';
import { mergeUserSettings } from '@/shared/userSettings';

// Global error handlers to catch crashes
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  log.error('Uncaught Exception:', error);
  // Don't exit, try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  log.error('Unhandled Rejection:', reason);
  // Don't exit, try to recover
});

class DigitalAssetDownloaderApp {
  private mainWindow: BrowserWindow | null = null;
  private store: Store<AppConfig>;
  private downloadService: DownloadService;
  private sqlServerService: SqlServerService;
  private sqlCredentialService!: SqlCredentialService;
  private currentSpreadsheetData: any[] | null = null;

  constructor() {
    // Initialize electron-log as early as possible with fallback
    try {
      log.transports.file.level = 'info';
      log.transports.console.level = 'warn';
      log.initialize();
      log.info('Application starting', {
        version: app.getVersion(),
        electron: process.versions.electron,
        platform: process.platform,
      });
    } catch (error) {
      console.error('Failed to initialize logging:', error);
    }

    this.store = new Store<AppConfig>({
      defaults: {
        windowState: {
          width: CONSTANTS.UI.DEFAULT_WINDOW_WIDTH,
          height: CONSTANTS.UI.DEFAULT_WINDOW_HEIGHT,
          isMaximized: false,
        },
        recentFiles: [],
      },
    });
    this.downloadService = new DownloadService();
    this.sqlServerService = new SqlServerService();
    this.currentSpreadsheetData = null;

    log.info('Application constructor completed successfully');
  }

  async createWindow(): Promise<void> {
    log.info('[Main] Creating application window');
    const windowState = this.store.get('windowState');

    // Create the browser window with saved bounds
    this.mainWindow = new BrowserWindow({
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: 900,
      minHeight: 700,
      backgroundColor: '#2d3748', // Dark background to prevent white flash
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      title: 'Digital Asset Downloader',
      show: false, // Don't show until ready
    });

    // Restore maximized state
    if (windowState.isMaximized) {
      this.mainWindow.maximize();
    }

    // Load the renderer
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      await this.mainWindow.loadFile(
        path.join(__dirname, '../renderer/index.html')
      );
      this.mainWindow.webContents.openDevTools(); // Enable DevTools for debugging
    } else {
      await this.mainWindow.loadFile(
        path.join(__dirname, '../renderer/index.html')
      );
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      this.mainWindow?.focus(); // Ensure window gets focus
    });

    // Force show window after a delay if it doesn't show automatically
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isVisible()) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }, 2000);

    // Handle window state changes
    this.mainWindow.on('close', () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds();
        const isMaximized = this.mainWindow.isMaximized();

        this.store.set('windowState', {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized,
        });
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Set up application menu
    this.createMenu();

    // Set up context menu for copy/paste
    this.setupContextMenu();
  }

  private createMenu(): void {
    const template: any[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Open Excel File...',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.openFileDialog(),
          },
          { type: 'separator' },
          {
            label: 'Save Configuration',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.saveConfiguration(),
          },
          { type: 'separator' },
          {
            label: 'Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => this.openSettings(),
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => app.quit(),
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteandmatchstyle' },
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectall' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'close' }],
      },
    ];

    // On macOS, add the app menu
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services', submenu: [] },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupContextMenu(): void {
    this.mainWindow?.webContents.on('context-menu', (event, params) => {
      const menu = new Menu();

      // Add copy/paste items when right-clicking on editable content
      if (params.isEditable) {
        menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
        menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
        menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));
      } else if (params.selectionText) {
        menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
      }

      // Only show context menu if there are items
      if (menu.items.length > 0) {
        menu.popup();
      }
    });
  }

  private setupIpcHandlers(): void {
    // File dialog handlers
    ipcMain.handle(IPC_CHANNELS.OPEN_FILE_DIALOG, async (_, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: [
          {
            name: 'All Supported Files',
            extensions: ['xlsx', 'xls', 'xlsm', 'csv'],
          },
          { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        ...options,
      });
      return result;
    });

    ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER_DIALOG, async (_, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openDirectory'],
        ...options,
      });
      return result;
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_, config: DownloadConfig) => {
      const { errors } = ValidationService.validateDownloadConfig(config);
      if (errors.length)
        throw new Error(`Invalid configuration: ${errors.join(', ')}`);
      this.store.set('lastConfiguration', config);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.LOAD_CONFIG, () => {
      const lastConfiguration = this.store.get('lastConfiguration');
      const sqlConnectionDetails = this.store.get('sqlConnectionDetails');
      if (!lastConfiguration && !sqlConnectionDetails) return null;
      return { lastConfiguration, sqlConnectionDetails };
    });

    // Excel/CSV handlers - Implemented with ExcelService
    ipcMain.handle(
      IPC_CHANNELS.GET_SHEET_NAMES,
      async (_, filePath: string) => {
        const sheets = await getSheetNames(filePath);
        return sheets;
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.LOAD_SHEET_DATA,
      async (_, filePath: string, sheetName: string) => {
        const data = await loadSheetData(filePath, sheetName);

        // Store the data for downloads
        this.currentSpreadsheetData = data.rows;

        // Add file to recent files list
        const recentFiles = this.store.get('recentFiles', []);
        const updatedRecentFiles = [
          filePath,
          ...recentFiles.filter(f => f !== filePath),
        ].slice(0, 10);
        this.store.set('recentFiles', updatedRecentFiles);

        return data;
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.TEST_SQL_CONNECTION,
      async (_, request: SqlConnectionTestRequest) => {
        const result = await this.sqlServerService.testConnection(request);
        this.store.set(
          'sqlConnectionDetails',
          this.sqlServerService.getSafeConnectionDetails(request)
        );
        return result;
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.PREVIEW_SQL_QUERY,
      async (_, request: SqlPreviewRequest) => {
        const result = await this.sqlServerService.previewQuery(request);
        this.store.set(
          'sqlConnectionDetails',
          this.sqlServerService.getSafeConnectionDetails(request)
        );
        return result;
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.LOAD_SQL_QUERY_DATA,
      async (_, request: SqlLoadRequest) => {
        const result = await this.sqlServerService.loadQueryData(request);
        this.currentSpreadsheetData = result.rows;
        this.store.set(
          'sqlConnectionDetails',
          this.sqlServerService.getSafeConnectionDetails(request)
        );
        return result;
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.LOAD_SAVED_SQL_PASSWORD,
      async (_, identity: SqlCredentialIdentity) => {
        return this.sqlCredentialService.loadSavedPassword(identity);
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.SAVE_SQL_PASSWORD,
      async (_, request: SqlPasswordSaveRequest) => {
        return this.sqlCredentialService.savePassword(request);
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.DELETE_SAVED_SQL_PASSWORD,
      async (_, request: SqlPasswordDeleteRequest) => {
        return this.sqlCredentialService.deleteSavedPassword(request);
      }
    );

    this.downloadService.on('progress', progress =>
      this.mainWindow?.webContents.send(
        IPC_CHANNELS.DOWNLOAD_PROGRESS,
        progress
      )
    );
    this.downloadService.on('complete', result =>
      this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, result)
    );

    // Download handlers - Advanced download engine implementation
    ipcMain.handle(
      IPC_CHANNELS.START_DOWNLOADS,
      async (_, config: DownloadConfig) => {
        if (!this.currentSpreadsheetData) {
          throw new Error(
            'No spreadsheet data loaded. Please load a file first.'
          );
        }

        const { errors } = ValidationService.validateDownloadConfig(config);
        if (errors.length) throw new Error(errors.join(', '));

        // Start downloads
        await this.downloadService.startDownloads(
          config,
          this.currentSpreadsheetData,
          mergeUserSettings(this.store.get('userSettings') ?? undefined)
            .downloadBehavior
        );
      }
    );

    ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOADS, () =>
      this.downloadService.cancelDownloads()
    );

    ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_, settings: UserSettings) => {
      const { errors } = ValidationService.validateUserSettings(settings);
      if (errors.length)
        throw new Error(`Invalid settings: ${errors.join(', ')}`);
      this.store.set('userSettings', mergeUserSettings(settings));
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.LOAD_SETTINGS, () =>
      mergeUserSettings(this.store.get('userSettings') ?? undefined)
    );

    ipcMain.handle(
      IPC_CHANNELS.SAVE_NETWORK_PATHS,
      (_, paths: NetworkPathDefaults) => {
        const { imageNetworkPath, pdfNetworkPath } = paths;
        if (
          typeof imageNetworkPath !== 'string' ||
          typeof pdfNetworkPath !== 'string'
        ) {
          throw new Error('Network paths must be text.');
        }
        const settings = mergeUserSettings(
          this.store.get('userSettings') ?? undefined
        );
        settings.defaultPaths.imageNetworkPath = imageNetworkPath;
        settings.defaultPaths.pdfNetworkPath = pdfNetworkPath;
        this.store.set('userSettings', settings);
      }
    );
  }

  private openFileDialog(): void {
    this.mainWindow?.webContents.send(IPC_CHANNELS.MENU_OPEN_FILE);
  }

  private saveConfiguration(): void {
    this.mainWindow?.webContents.send(IPC_CHANNELS.MENU_SAVE_CONFIG);
  }

  private openSettings(): void {
    this.mainWindow?.webContents.send(IPC_CHANNELS.MENU_OPEN_SETTINGS);
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    this.sqlCredentialService = new SqlCredentialService(
      path.join(app.getPath('userData'), 'sql-credentials')
    );
    // Setup IPC handlers BEFORE creating window to avoid race conditions
    this.setupIpcHandlers();
    await this.createWindow();
    registerUpdates(
      (channel, payload) => this.mainWindow?.webContents.send(channel, payload),
      this.store.get('userSettings')?.updateSettings
    );

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
}

// Initialize the application
const digitalAssetDownloader = new DigitalAssetDownloaderApp();
digitalAssetDownloader.initialize().catch(console.error);
