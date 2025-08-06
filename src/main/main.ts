import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as path from 'path';
import Store from 'electron-store';
import { IPC_CHANNELS, AppConfig, DownloadConfig } from '@/shared/types';
import { ExcelService } from '@/services/excelService';
import { DownloadService } from '@/services/downloadService';

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
  private excelService: ExcelService;
  private downloadService: DownloadService;
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
          width: 1200,
          height: 800,
          isMaximized: false,
        },
        recentFiles: [],
      },
    });
    this.excelService = new ExcelService();
    this.downloadService = new DownloadService();
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

    ipcMain.handle(IPC_CHANNELS.SAVE_FILE_DIALOG, async (_, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        ...options,
      });
      return result;
    });

    // Configuration handlers
    ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, async (_, config) => {
      this.store.set('lastConfiguration', config);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.LOAD_CONFIG, async () => {
      const config = this.store.get('lastConfiguration');
      return config || null;
    });

    // Excel/CSV handlers - Implemented with ExcelService
    ipcMain.handle(
      IPC_CHANNELS.GET_SHEET_NAMES,
      async (_, filePath: string) => {
        try {
          const sheets = await this.excelService.getSheetNames(filePath);
          return sheets;
        } catch (error) {
          console.error('Error getting sheet names:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          throw new Error(errorMessage);
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.LOAD_SHEET_DATA,
      async (_, filePath: string, sheetName: string) => {
        try {
          const data = await this.excelService.loadSheetData(
            filePath,
            sheetName
          );

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
        } catch (error) {
          console.error('Error loading sheet data:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          throw new Error(errorMessage);
        }
      }
    );

    // Download handlers - Advanced download engine implementation
    ipcMain.handle(
      IPC_CHANNELS.START_DOWNLOADS,
      async (_, config: DownloadConfig) => {
        try {
          if (!this.currentSpreadsheetData) {
            throw new Error(
              'No spreadsheet data loaded. Please load a file first.'
            );
          }

          // Validate configuration
          if (!config.partNoColumn) {
            throw new Error('Please select a Part Number column');
          }

          if (!config.imageColumns.length && !config.pdfColumn) {
            throw new Error(
              'Please select at least one Image URL column or PDF column'
            );
          }

          if (!config.imageFolder && !config.pdfFolder) {
            throw new Error('Please select download folders');
          }

          // Set up download event listeners
          this.downloadService.removeAllListeners();

          this.downloadService.on('progress', progress => {
            this.mainWindow?.webContents.send(
              IPC_CHANNELS.DOWNLOAD_PROGRESS,
              progress
            );
          });

          this.downloadService.on('complete', result => {
            this.mainWindow?.webContents.send(
              IPC_CHANNELS.DOWNLOAD_COMPLETE,
              result
            );
          });

          this.downloadService.on('error', error => {
            this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });

          this.downloadService.on('cancelled', () => {
            this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, {
              cancelled: true,
              successful: this.downloadService.getProgress().successful,
              failed: this.downloadService.getProgress().failed,
            });
          });

          // Start downloads
          await this.downloadService.startDownloads(
            config,
            this.currentSpreadsheetData
          );

          return { success: true, message: 'Downloads started successfully' };
        } catch (error) {
          console.error('Error starting downloads:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          throw new Error(errorMessage);
        }
      }
    );

    ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOADS, async () => {
      try {
        this.downloadService.cancelDownloads();
        return { success: true, message: 'Downloads cancelled' };
      } catch (error) {
        console.error('Error cancelling downloads:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(errorMessage);
      }
    });

    // Window control handlers
    ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, () => {
      this.mainWindow?.close();
    });

    // Settings handlers
    ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_, settings) => {
      this.store.set('userSettings', settings);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.LOAD_SETTINGS, async () => {
      return (
        this.store.get('userSettings') || {
          defaultPaths: {
            lastFileDialogPath: '',
            imageNetworkPath: '',
            pdfNetworkPath: '',
          },
        }
      );
    });
  }

  private openFileDialog(): void {
    this.mainWindow?.webContents.send('menu-open-file');
  }

  private saveConfiguration(): void {
    this.mainWindow?.webContents.send('menu-save-config');
  }

  private openSettings(): void {
    this.mainWindow?.webContents.send('menu-open-settings');
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater logging
    log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
    autoUpdater.logger = log;
    log.info('Auto-updater initialized');

    // Configure auto-updater behavior
    autoUpdater.autoDownload = false; // Let user control download
    autoUpdater.autoInstallOnAppQuit = false; // Let user control install
    log.info('Auto-updater configuration:', {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      version: app.getVersion(),
    });

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates');
      this.mainWindow?.webContents.send('update-checking');
    });

    autoUpdater.on('update-available', info => {
      log.info('Update available', { version: info.version });
      this.mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_AVAILABLE, info);
    });

    autoUpdater.on('update-not-available', info => {
      log.info('Update not available', { currentVersion: info.version });
      this.mainWindow?.webContents.send(
        IPC_CHANNELS.UPDATE_NOT_AVAILABLE,
        info
      );
    });

    autoUpdater.on('error', err => {
      log.error('Auto-updater error', err);
      this.mainWindow?.webContents.send('update-error', err.message);
    });

    autoUpdater.on('download-progress', progressObj => {
      log.info('Download progress', { percent: progressObj.percent });
      this.mainWindow?.webContents.send(
        IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS,
        progressObj
      );
    });

    autoUpdater.on('update-downloaded', info => {
      log.info('Update downloaded', { version: info.version });
      this.mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_DOWNLOADED, info);
    });

    // Enhanced IPC handler with comprehensive error handling and timeout
    ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
      log.info('Manual update check requested');

      // Create a promise that resolves with all possible outcomes
      return new Promise((resolve, reject) => {
        let resolved = false;

        // Set up one-time listeners for this specific check
        const cleanup = () => {
          autoUpdater.removeAllListeners('update-available');
          autoUpdater.removeAllListeners('update-not-available');
          autoUpdater.removeAllListeners('error');
        };

        const handleResponse = (type: string, data?: any) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            log.info(`Update check completed with result: ${type}`, data);
            resolve({ type, data });
          }
        };

        // Set up temporary event listeners for this check
        autoUpdater.once('update-available', info => {
          handleResponse('available', info);
        });

        autoUpdater.once('update-not-available', info => {
          handleResponse('not-available', info);
        });

        autoUpdater.once('error', err => {
          handleResponse('error', err.message);
        });

        // Add timeout to catch silent failures (30 seconds)
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            cleanup();
            log.error(
              'Update check timed out after 30 seconds - this indicates a silent failure'
            );
            reject(
              new Error(
                'Update check timed out - possible GitHub API issues or rate limiting'
              )
            );
          }
        }, 30000);

        // Clear timeout when resolved
        const originalResolve = resolve;
        resolve = (value: any) => {
          clearTimeout(timeoutId);
          originalResolve(value);
        };

        const originalReject = reject;
        reject = (reason: any) => {
          clearTimeout(timeoutId);
          originalReject(reason);
        };

        // Trigger the actual update check
        autoUpdater
          .checkForUpdates()
          .then(result => {
            if (!result && !resolved) {
              log.warn(
                'Update check returned null - possible rate limiting or API issue'
              );
              handleResponse(
                'error',
                'Update check returned null - possible rate limiting or GitHub API issue'
              );
            }
          })
          .catch(error => {
            log.error('Update check failed', error);
            if (!resolved) {
              handleResponse('error', error.message);
            }
          });
      });
    });

    ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, () => {
      log.info('Install update requested');
      autoUpdater.quitAndInstall();
    });

    ipcMain.handle('download-update', () => {
      log.info('Download update requested');
      return autoUpdater.downloadUpdate();
    });

    // Check for updates on startup based on user settings
    this.checkForUpdatesOnStartup();
  }

  private async checkForUpdatesOnStartup(): Promise<void> {
    try {
      const userSettings = this.store.get('userSettings');

      // Only check if user has enabled auto-updates and startup checking
      if (
        userSettings?.updateSettings?.enableAutoUpdates &&
        userSettings?.updateSettings?.checkForUpdatesOnStartup
      ) {
        log.info('Auto-updates enabled, scheduling startup check');
        // Wait a bit for the app to fully load
        setTimeout(() => {
          autoUpdater.checkForUpdatesAndNotify();
        }, 3000);
      }
    } catch (error) {
      log.error('Error checking startup settings', error);
    }
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    // Setup IPC handlers BEFORE creating window to avoid race conditions
    this.setupIpcHandlers();
    await this.createWindow();
    this.setupAutoUpdater();

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
