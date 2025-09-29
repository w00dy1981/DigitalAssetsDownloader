import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, IpcChannelType } from '@/shared/types';

// Provide require function for webpack externals
(window as any).require = (moduleName: string) => {
  switch (moduleName) {
    case 'react':
      return require('react');
    case 'react-dom':
      return require('react-dom');
    default:
      throw new Error(`Module '${moduleName}' is not available in renderer process`);
  }
};
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as stream from 'stream';
import * as events from 'events';
import * as util from 'util';
import * as url from 'url';
import * as querystring from 'querystring';
import * as child_process from 'child_process';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: (options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE_DIALOG, options),
  openFolderDialog: (options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER_DIALOG, options),
  saveFileDialog: (options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE_DIALOG, options),

  // Excel operations
  loadExcelFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_EXCEL_FILE, filePath),
  getSheetNames: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SHEET_NAMES, filePath),
  loadSheetData: (filePath: string, sheetName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_SHEET_DATA, filePath, sheetName),

  // Configuration
  saveConfig: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  loadConfig: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CONFIG),

  // Settings
  saveSettings: (settings: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SETTINGS),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_UPDATE),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),

  // Window operations
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.MAXIMIZE_WINDOW),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW),

  // Download operations
  startDownloads: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_DOWNLOADS, config),
  cancelDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_DOWNLOADS),

  // Event listeners
  onDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, (_, data) => callback(data));
  },
  onDownloadComplete: (callback: (data: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_COMPLETE, (_, data) => callback(data));
  },
  onMenuOpenFile: (callback: () => void) => {
    ipcRenderer.on('menu-open-file', callback);
  },
  onMenuSaveConfig: (callback: () => void) => {
    ipcRenderer.on('menu-save-config', callback);
  },
  onMenuOpenSettings: (callback: () => void) => {
    ipcRenderer.on('menu-open-settings', callback);
  },

  // Auto-updater event listeners
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback);
  },
  onUpdateAvailable: (callback: (updateInfo: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.UPDATE_AVAILABLE, (_, updateInfo) =>
      callback(updateInfo)
    );
  },
  onUpdateNotAvailable: (callback: (updateInfo: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, (_, updateInfo) =>
      callback(updateInfo)
    );
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },
  onUpdateDownloaded: (callback: (updateInfo: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.UPDATE_DOWNLOADED, (_, updateInfo) =>
      callback(updateInfo)
    );
  },
  onUpdateDownloadProgress: (callback: (progressInfo: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS, (_, progressInfo) =>
      callback(progressInfo)
    );
  },

  // Remove listeners
  removeAllListeners: (channel: IpcChannelType) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Expose Node.js modules for services that need them
contextBridge.exposeInMainWorld('require', (module: string) => {
  switch (module) {
    case 'fs':
      return fs;
    case 'fs/promises':
      return fsPromises;
    case 'path':
      return path;
    case 'os':
      return os;
    case 'crypto':
      return crypto;
    case 'stream':
      return stream;
    case 'events':
      return events;
    case 'util':
      return util;
    case 'url':
      return url;
    case 'querystring':
      return querystring;
    case 'child_process':
      return child_process;
    default:
      throw new Error(`Module ${module} is not available`);
  }
});

// Type definition for the exposed API
declare global {
  interface Window {
    electronAPI: {
      openFileDialog: (options?: any) => Promise<any>;
      openFolderDialog: (options?: any) => Promise<any>;
      saveFileDialog: (options?: any) => Promise<any>;
      loadExcelFile: (filePath: string) => Promise<any>;
      getSheetNames: (filePath: string) => Promise<any>;
      loadSheetData: (filePath: string, sheetName: string) => Promise<any>;
      saveConfig: (config: any) => Promise<any>;
      loadConfig: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      loadSettings: () => Promise<any>;
      checkForUpdates: () => Promise<any>;
      installUpdate: () => Promise<void>;
      downloadUpdate: () => Promise<any>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      startDownloads: (config: any) => Promise<any>;
      cancelDownloads: () => Promise<void>;
      onDownloadProgress: (callback: (data: any) => void) => void;
      onDownloadComplete: (callback: (data: any) => void) => void;
      onMenuOpenFile: (callback: () => void) => void;
      onMenuSaveConfig: (callback: () => void) => void;
      onMenuOpenSettings: (callback: () => void) => void;
      onUpdateChecking: (callback: () => void) => void;
      onUpdateAvailable: (callback: (updateInfo: any) => void) => void;
      onUpdateNotAvailable: (callback: (updateInfo: any) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      onUpdateDownloaded: (callback: (updateInfo: any) => void) => void;
      onUpdateDownloadProgress: (callback: (progressInfo: any) => void) => void;
      removeAllListeners: (channel: IpcChannelType) => void;
    };
    require: (module: string) => any;
  }
}
