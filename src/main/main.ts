import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { IPC_CHANNELS, WindowState, AppConfig } from '@/shared/types';

class DigitalAssetDownloaderApp {
  private mainWindow: BrowserWindow | null = null;
  private store: Store<AppConfig>;

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
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

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
  }

  private createMenu(): void {
    const template = [
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
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => app.quit(),
          },
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

    const menu = Menu.buildFromTemplate(template as any);
    Menu.setApplicationMenu(menu);
  }

  private setupIpcHandlers(): void {
    // File dialog handlers
    ipcMain.handle(IPC_CHANNELS.OPEN_FILE_DIALOG, async (_, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: [
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
  }

  private openFileDialog(): void {
    this.mainWindow?.webContents.send('menu-open-file');
  }

  private saveConfiguration(): void {
    this.mainWindow?.webContents.send('menu-save-config');
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    await this.createWindow();
    this.setupIpcHandlers();

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
