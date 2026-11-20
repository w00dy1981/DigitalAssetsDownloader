import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MenuItem,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
} from 'electron';
import log from 'electron-log';
import { join } from 'node:path';
import { IPC_CHANNELS } from '@/shared/types';
import { registerAssetWorkflow } from './assetWorkflow';
import {
  registerConfiguration,
  type DesktopConfiguration,
} from './configuration';
import { registerSqlCredentials } from './sqlCredentials';
import { registerUpdates } from './updates';

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

function initializeLogging(): void {
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
}

let mainWindow: BrowserWindow | null = null;

function send(channel: string, payload?: unknown) {
  mainWindow?.webContents.send(channel, payload);
}

async function createWindow(
  configuration: DesktopConfiguration
): Promise<void> {
  log.info('[Main] Creating application window');
  const state = configuration.getWindowState();
  const window = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: '#2d3748',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
    title: 'Digital Asset Downloader',
    show: false,
  });
  mainWindow = window;

  if (state.isMaximized) window.maximize();

  const showWindow = () => {
    window.show();
    window.focus();
  };
  // Keep the window usable if Chromium does not emit ready-to-show.
  const showTimer = setTimeout(() => {
    if (!window.isVisible()) showWindow();
  }, 2000);
  window.once('ready-to-show', () => {
    clearTimeout(showTimer);
    showWindow();
  });

  window.on('close', () => {
    const { width, height, x, y } = window.getBounds();
    configuration.saveWindowState({
      width,
      height,
      x,
      y,
      isMaximized: window.isMaximized(),
    });
  });
  window.on('closed', () => {
    clearTimeout(showTimer);
    mainWindow = null;
  });

  setupContextMenu(window);
  await window.loadFile(join(__dirname, '../renderer/index.html'));
  if (process.env.NODE_ENV === 'development') {
    window.webContents.openDevTools();
  }
}

function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Excel File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => send(IPC_CHANNELS.MENU_OPEN_FILE),
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => send(IPC_CHANNELS.MENU_OPEN_SETTINGS),
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
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
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
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_, params) => {
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
      menu.popup({ window });
    }
  });
}

function showOpenDialog(options: OpenDialogOptions) {
  return mainWindow
    ? dialog.showOpenDialog(mainWindow, options)
    : dialog.showOpenDialog(options);
}

function registerDialogs(): void {
  ipcMain.handle(
    IPC_CHANNELS.OPEN_FILE_DIALOG,
    (_, options?: OpenDialogOptions) =>
      showOpenDialog({
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
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.OPEN_FOLDER_DIALOG,
    (_, options?: OpenDialogOptions) =>
      showOpenDialog({
        properties: ['openDirectory'],
        ...options,
      })
  );
}

async function initialize(): Promise<void> {
  initializeLogging();
  await app.whenReady();
  const configuration = registerConfiguration();
  registerDialogs();
  registerSqlCredentials();
  registerAssetWorkflow(configuration, send);
  createMenu();
  await createWindow(configuration);
  registerUpdates(send, configuration.getStartupUpdateSettings());

  app.on('activate', () => {
    if (!mainWindow) void createWindow(configuration).catch(console.error);
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

void initialize().catch(console.error);
