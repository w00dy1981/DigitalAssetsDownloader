import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import Store from 'electron-store';
import { IPC_CHANNELS, WindowState, AppConfig, DownloadConfig } from '@/shared/types';
import { ExcelService } from '@/services/excelService';
import { DownloadService } from '@/services/downloadService';

class DigitalAssetDownloaderApp {
  private mainWindow: BrowserWindow | null = null;
  private store: Store<AppConfig>;
  private excelService: ExcelService;
  private downloadService: DownloadService;
  private currentSpreadsheetData: any[] | null = null;

  constructor() {
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
  }

  async createWindow(): Promise<void> {
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
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
      // this.mainWindow.webContents.openDevTools(); // Uncomment to open DevTools
    } else {
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
        ],
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
          { name: 'All Supported Files', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
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
    ipcMain.handle(IPC_CHANNELS.GET_SHEET_NAMES, async (_, filePath: string) => {
      try {
        const sheets = await this.excelService.getSheetNames(filePath);
        return sheets;
      } catch (error) {
        console.error('Error getting sheet names:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(errorMessage);
      }
    });

    ipcMain.handle(IPC_CHANNELS.LOAD_SHEET_DATA, async (_, filePath: string, sheetName: string) => {
      try {
        const data = await this.excelService.loadSheetData(filePath, sheetName);
        
        // Store the data for downloads
        this.currentSpreadsheetData = data.rows;
        
        // Add file to recent files list
        const recentFiles = this.store.get('recentFiles', []);
        const updatedRecentFiles = [filePath, ...recentFiles.filter(f => f !== filePath)].slice(0, 10);
        this.store.set('recentFiles', updatedRecentFiles);
        
        return data;
      } catch (error) {
        console.error('Error loading sheet data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(errorMessage);
      }
    });

    // Download handlers - Advanced download engine implementation
    ipcMain.handle(IPC_CHANNELS.START_DOWNLOADS, async (_, config: DownloadConfig) => {
      try {
        if (!this.currentSpreadsheetData) {
          throw new Error('No spreadsheet data loaded. Please load a file first.');
        }

        // Validate configuration
        if (!config.partNoColumn) {
          throw new Error('Please select a Part Number column');
        }

        if (!config.imageColumns.length && !config.pdfColumn) {
          throw new Error('Please select at least one Image URL column or PDF column');
        }

        if (!config.imageFolder && !config.pdfFolder) {
          throw new Error('Please select download folders');
        }

        // Set up download event listeners
        this.downloadService.removeAllListeners();
        
        this.downloadService.on('progress', (progress) => {
          this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
        });

        this.downloadService.on('complete', (result) => {
          this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, result);
        });

        this.downloadService.on('error', (error) => {
          this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });

        this.downloadService.on('cancelled', () => {
          this.mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, {
            cancelled: true,
            successful: this.downloadService.getProgress().successful,
            failed: this.downloadService.getProgress().failed
          });
        });

        // Start downloads
        await this.downloadService.startDownloads(config, this.currentSpreadsheetData);
        
        return { success: true, message: 'Downloads started successfully' };
      } catch (error) {
        console.error('Error starting downloads:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(errorMessage);
      }
    });

    ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOADS, async () => {
      try {
        this.downloadService.cancelDownloads();
        return { success: true, message: 'Downloads cancelled' };
      } catch (error) {
        console.error('Error cancelling downloads:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
      return this.store.get('userSettings') || {
        defaultPaths: {
          lastFileDialogPath: '',
          imageNetworkPath: '',
          pdfNetworkPath: ''
        }
      };
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
    // Configure auto-updater behavior
    autoUpdater.autoDownload = false; // Let user control download
    autoUpdater.autoInstallOnAppQuit = false; // Let user control install

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
      this.mainWindow?.webContents.send('update-checking');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      this.mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_AVAILABLE, info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
      this.mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err);
      this.mainWindow?.webContents.send('update-error', err.message);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS, progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_DOWNLOADED, info);
    });

    // Set up IPC handlers for auto-updater
    ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return result;
      } catch (error) {
        console.error('Check for updates error:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, () => {
      autoUpdater.quitAndInstall();
    });

    ipcMain.handle('download-update', () => {
      return autoUpdater.downloadUpdate();
    });

    // Check for updates on startup based on user settings
    this.checkForUpdatesOnStartup();
  }

  private async checkForUpdatesOnStartup(): Promise<void> {
    try {
      const userSettings = this.store.get('userSettings');
      
      // Only check if user has enabled auto-updates and startup checking
      if (userSettings?.updateSettings?.enableAutoUpdates && 
          userSettings?.updateSettings?.checkForUpdatesOnStartup) {
        
        // Wait a bit for the app to fully load
        setTimeout(() => {
          autoUpdater.checkForUpdatesAndNotify();
        }, 3000);
      }
    } catch (error) {
      console.error('Error checking startup settings:', error);
    }
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    await this.createWindow();
    this.setupIpcHandlers();
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
