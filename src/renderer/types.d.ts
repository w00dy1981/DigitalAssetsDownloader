// Global type definitions for the renderer process

import { IpcChannelType } from '@/shared/types';

declare global {
  interface Window {
    electronAPI: {
      // File operations
      openFileDialog: (options?: any) => Promise<any>;
      openFolderDialog: (options?: any) => Promise<any>;
      saveFileDialog: (options?: any) => Promise<any>;
      
      // Excel operations
      loadExcelFile: (filePath: string) => Promise<any>;
      getSheetNames: (filePath: string) => Promise<string[]>;
      loadSheetData: (filePath: string, sheetName: string) => Promise<any>;
      
      // Configuration
      saveConfig: (config: any) => Promise<any>;
      loadConfig: () => Promise<any>;
      
      // Settings operations
      saveSettings: (settings: any) => Promise<any>;
      loadSettings: () => Promise<any>;
      
      // Auto-updater operations
      checkForUpdates: () => Promise<any>;
      installUpdate: () => Promise<void>;
      downloadUpdate: () => Promise<any>;
      
      // Window operations
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      
      // Download operations
      startDownloads: (config: any) => Promise<any>;
      cancelDownloads: () => Promise<void>;
      
      // Event listeners
      onDownloadProgress: (callback: (data: any) => void) => void;
      onDownloadComplete: (callback: (data: any) => void) => void;
      onMenuOpenFile: (callback: () => void) => void;
      onMenuSaveConfig: (callback: () => void) => void;
      onMenuOpenSettings: (callback: () => void) => void;
      
      // Auto-updater event listeners
      onUpdateAvailable: (callback: (updateInfo: any) => void) => void;
      onUpdateNotAvailable: (callback: (updateInfo: any) => void) => void;
      onUpdateDownloaded: (callback: (updateInfo: any) => void) => void;
      onUpdateDownloadProgress: (callback: (progressInfo: any) => void) => void;
      
      // Remove listeners
      removeAllListeners: (channel: IpcChannelType) => void;
    };
  }
  
  // Extend File interface to include path property (for Electron)
  interface File {
    path?: string;
  }
}

export {};
