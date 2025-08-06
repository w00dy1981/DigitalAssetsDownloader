/**
 * IPCService - Centralized IPC communication wrapper
 * Following KISS, DRY, and SOLID principles
 * 
 * KISS: Simple wrapper around electronAPI with type safety
 * DRY: Single place for all IPC communication
 * SOLID: Single responsibility - IPC communication only
 */

import { logger } from './LoggingService';
import { 
  DownloadConfig, 
  UserSettings, 
  AppConfig, 
  SpreadsheetData, 
  DownloadProgress, 
  IPC_CHANNELS 
} from '@/shared/types';

// Type definitions for IPC operations
export interface FileDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: string[];
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
  filePath?: string;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DownloadStartResult {
  success: boolean;
  message: string;
  error?: string;
}

// Event callback types
export type ProgressCallback = (data: DownloadProgress) => void;
export type DownloadCompleteCallback = (data: any) => void;
export type MenuCallback = () => void;
export type UpdateCallback = (updateInfo: any) => void;
export type UpdateErrorCallback = (error: string) => void;
export type UpdateProgressCallback = (progressInfo: any) => void;

/**
 * Centralized IPC Service for all Electron communication
 * Provides type-safe methods, consistent error handling, and logging
 */
export class IPCService {
  private static instance: IPCService;

  private constructor() {}

  static getInstance(): IPCService {
    if (!this.instance) {
      this.instance = new IPCService();
    }
    return this.instance;
  }

  /**
   * Checks if electronAPI is available
   * Useful for development mode and testing
   */
  isElectronAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI;
  }

  /**
   * Generic IPC call wrapper with error handling and logging
   */
  private async safeIPC<T>(
    operation: string,
    ipcCall: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const logContext = context || 'IPC';
    
    try {
      if (!this.isElectronAvailable()) {
        const error = new Error('Electron API not available');
        logger.error(`IPC call failed: ${operation}`, error, logContext);
        throw error;
      }

      logger.debug(`Starting IPC call: ${operation}`, logContext);
      const result = await ipcCall();
      logger.debug(`IPC call completed: ${operation}`, logContext, result);
      
      return result;
    } catch (error) {
      logger.error(`IPC call failed: ${operation}`, error as Error, logContext);
      throw error;
    }
  }

  // ===========================================
  // FILE OPERATIONS
  // ===========================================

  async openFileDialog(options?: FileDialogOptions): Promise<FileDialogResult> {
    return this.safeIPC(
      'openFileDialog',
      () => window.electronAPI.openFileDialog(options),
      'FileDialog'
    );
  }

  async openFolderDialog(options?: FileDialogOptions): Promise<FileDialogResult> {
    return this.safeIPC(
      'openFolderDialog', 
      () => window.electronAPI.openFolderDialog(options),
      'FileDialog'
    );
  }

  async saveFileDialog(options?: FileDialogOptions): Promise<FileDialogResult> {
    return this.safeIPC(
      'saveFileDialog',
      () => window.electronAPI.saveFileDialog(options),
      'FileDialog'
    );
  }

  // ===========================================
  // EXCEL OPERATIONS
  // ===========================================

  async loadExcelFile(filePath: string): Promise<any> {
    return this.safeIPC(
      'loadExcelFile',
      () => window.electronAPI.loadExcelFile(filePath),
      'Excel'
    );
  }

  async getSheetNames(filePath: string): Promise<string[]> {
    return this.safeIPC(
      'getSheetNames',
      () => window.electronAPI.getSheetNames(filePath),
      'Excel'
    );
  }

  async loadSheetData(filePath: string, sheetName: string): Promise<SpreadsheetData> {
    return this.safeIPC(
      'loadSheetData',
      () => window.electronAPI.loadSheetData(filePath, sheetName),
      'Excel'
    );
  }

  // ===========================================
  // CONFIGURATION OPERATIONS
  // ===========================================

  async saveConfig(config: DownloadConfig): Promise<IPCResponse> {
    return this.safeIPC(
      'saveConfig',
      () => window.electronAPI.saveConfig(config),
      'Config'
    );
  }

  async loadConfig(): Promise<AppConfig | null> {
    return this.safeIPC(
      'loadConfig',
      () => window.electronAPI.loadConfig(),
      'Config'
    );
  }

  // ===========================================
  // SETTINGS OPERATIONS
  // ===========================================

  async saveSettings(settings: UserSettings): Promise<IPCResponse> {
    return this.safeIPC(
      'saveSettings',
      () => window.electronAPI.saveSettings(settings),
      'Settings'
    );
  }

  async loadSettings(): Promise<UserSettings | null> {
    return this.safeIPC(
      'loadSettings',
      () => window.electronAPI.loadSettings(),
      'Settings'
    );
  }

  // ===========================================
  // UPDATE OPERATIONS
  // ===========================================

  async checkForUpdates(): Promise<any> {
    return this.safeIPC(
      'checkForUpdates',
      () => window.electronAPI.checkForUpdates(),
      'Updates'
    );
  }

  async installUpdate(): Promise<void> {
    return this.safeIPC(
      'installUpdate',
      () => window.electronAPI.installUpdate(),
      'Updates'
    );
  }

  async downloadUpdate(): Promise<any> {
    return this.safeIPC(
      'downloadUpdate',
      () => window.electronAPI.downloadUpdate(),
      'Updates'
    );
  }

  // ===========================================
  // WINDOW OPERATIONS
  // ===========================================

  async minimizeWindow(): Promise<void> {
    return this.safeIPC(
      'minimizeWindow',
      () => window.electronAPI.minimizeWindow(),
      'Window'
    );
  }

  async maximizeWindow(): Promise<void> {
    return this.safeIPC(
      'maximizeWindow',
      () => window.electronAPI.maximizeWindow(),
      'Window'
    );
  }

  async closeWindow(): Promise<void> {
    return this.safeIPC(
      'closeWindow',
      () => window.electronAPI.closeWindow(),
      'Window'
    );
  }

  // ===========================================
  // DOWNLOAD OPERATIONS
  // ===========================================

  async startDownloads(config: DownloadConfig): Promise<DownloadStartResult> {
    return this.safeIPC(
      'startDownloads',
      () => window.electronAPI.startDownloads(config),
      'Downloads'
    );
  }

  async cancelDownloads(): Promise<void> {
    return this.safeIPC(
      'cancelDownloads',
      () => window.electronAPI.cancelDownloads(),
      'Downloads'
    );
  }

  // ===========================================
  // EVENT LISTENERS
  // ===========================================

  /**
   * Register download progress callback with error handling
   */
  onDownloadProgress(callback: ProgressCallback): void {
    if (!this.isElectronAvailable()) {
      logger.warn('Cannot register download progress listener - Electron API not available');
      return;
    }

    const wrappedCallback: ProgressCallback = (data) => {
      try {
        logger.debug('Download progress event received', 'Downloads', data);
        callback(data);
      } catch (error) {
        logger.error('Error in download progress callback', error as Error, 'Downloads');
      }
    };

    window.electronAPI.onDownloadProgress(wrappedCallback);
    logger.debug('Registered download progress listener', 'Downloads');
  }

  /**
   * Register download complete callback with error handling
   */
  onDownloadComplete(callback: DownloadCompleteCallback): void {
    if (!this.isElectronAvailable()) {
      logger.warn('Cannot register download complete listener - Electron API not available');
      return;
    }

    const wrappedCallback: DownloadCompleteCallback = (data) => {
      try {
        logger.debug('Download complete event received', 'Downloads', data);
        callback(data);
      } catch (error) {
        logger.error('Error in download complete callback', error as Error, 'Downloads');
      }
    };

    window.electronAPI.onDownloadComplete(wrappedCallback);
    logger.debug('Registered download complete listener', 'Downloads');
  }

  /**
   * Register menu event callbacks
   */
  onMenuOpenFile(callback: MenuCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onMenuOpenFile(callback);
    logger.debug('Registered menu open file listener', 'Menu');
  }

  onMenuSaveConfig(callback: MenuCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onMenuSaveConfig(callback);
    logger.debug('Registered menu save config listener', 'Menu');
  }

  onMenuOpenSettings(callback: MenuCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onMenuOpenSettings(callback);
    logger.debug('Registered menu open settings listener', 'Menu');
  }

  /**
   * Register update event callbacks
   */
  onUpdateChecking(callback: MenuCallback): void {
    if (!this.isElectronAvailable() || !window.electronAPI.onUpdateChecking) return;
    window.electronAPI.onUpdateChecking(callback);
    logger.debug('Registered update checking listener', 'Updates');
  }

  onUpdateAvailable(callback: UpdateCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onUpdateAvailable(callback);
    logger.debug('Registered update available listener', 'Updates');
  }

  onUpdateNotAvailable(callback: UpdateCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onUpdateNotAvailable(callback);
    logger.debug('Registered update not available listener', 'Updates');
  }

  onUpdateError(callback: UpdateErrorCallback): void {
    if (!this.isElectronAvailable() || !window.electronAPI.onUpdateError) return;
    window.electronAPI.onUpdateError(callback);
    logger.debug('Registered update error listener', 'Updates');
  }

  onUpdateDownloaded(callback: UpdateCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onUpdateDownloaded(callback);
    logger.debug('Registered update downloaded listener', 'Updates');
  }

  onUpdateDownloadProgress(callback: UpdateProgressCallback): void {
    if (!this.isElectronAvailable()) return;
    window.electronAPI.onUpdateDownloadProgress(callback);
    logger.debug('Registered update download progress listener', 'Updates');
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  /**
   * Remove all listeners for a specific channel
   */
  removeAllListeners(channel: keyof typeof IPC_CHANNELS | string): void {
    if (!this.isElectronAvailable()) return;
    
    try {
      window.electronAPI.removeAllListeners(channel as any);
      logger.debug(`Removed all listeners for channel: ${channel}`, 'IPC');
    } catch (error) {
      logger.error(`Failed to remove listeners for channel: ${channel}`, error as Error, 'IPC');
    }
  }

  /**
   * Remove all listeners for multiple channels
   */
  removeMultipleListeners(channels: Array<keyof typeof IPC_CHANNELS | string>): void {
    channels.forEach(channel => this.removeAllListeners(channel));
  }

  /**
   * Cleanup method for component unmounting
   */
  cleanup(channels?: Array<keyof typeof IPC_CHANNELS | string>): void {
    if (channels) {
      this.removeMultipleListeners(channels);
    } else {
      // Remove common listeners if no specific channels provided
      const commonChannels = [
        IPC_CHANNELS.DOWNLOAD_PROGRESS,
        IPC_CHANNELS.DOWNLOAD_COMPLETE,
        IPC_CHANNELS.UPDATE_AVAILABLE,
        IPC_CHANNELS.UPDATE_NOT_AVAILABLE,
        'update-checking',
        'update-error'
      ];
      this.removeMultipleListeners(commonChannels);
    }
    logger.debug('IPC cleanup completed', 'IPC');
  }
}

// Export singleton instance for convenience
export const ipcService = IPCService.getInstance();

// Type-safe IPC hook for React components (builds on existing useElectronIPC)
export interface IPCHookMethods {
  // File operations
  openFileDialog: (options?: FileDialogOptions) => Promise<FileDialogResult>;
  openFolderDialog: (options?: FileDialogOptions) => Promise<FileDialogResult>;
  saveFileDialog: (options?: FileDialogOptions) => Promise<FileDialogResult>;
  
  // Excel operations
  loadExcelFile: (filePath: string) => Promise<any>;
  getSheetNames: (filePath: string) => Promise<string[]>;
  loadSheetData: (filePath: string, sheetName: string) => Promise<SpreadsheetData>;
  
  // Configuration
  saveConfig: (config: DownloadConfig) => Promise<IPCResponse>;
  loadConfig: () => Promise<AppConfig | null>;
  
  // Settings
  saveSettings: (settings: UserSettings) => Promise<IPCResponse>;
  loadSettings: () => Promise<UserSettings | null>;
  
  // Updates
  checkForUpdates: () => Promise<any>;
  installUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<any>;
  
  // Window operations
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  
  // Downloads
  startDownloads: (config: DownloadConfig) => Promise<DownloadStartResult>;
  cancelDownloads: () => Promise<void>;
  
  // Event management
  onDownloadProgress: (callback: ProgressCallback) => void;
  onDownloadComplete: (callback: DownloadCompleteCallback) => void;
  removeAllListeners: (channel: keyof typeof IPC_CHANNELS | string) => void;
  cleanup: (channels?: Array<keyof typeof IPC_CHANNELS | string>) => void;
}

/**
 * React hook that provides type-safe access to IPC operations
 * Extends the existing useElectronIPC hook with full IPC service functionality
 */
export const useIPCService = (): IPCHookMethods => {
  const service = ipcService;

  return {
    // File operations
    openFileDialog: service.openFileDialog.bind(service),
    openFolderDialog: service.openFolderDialog.bind(service),
    saveFileDialog: service.saveFileDialog.bind(service),
    
    // Excel operations
    loadExcelFile: service.loadExcelFile.bind(service),
    getSheetNames: service.getSheetNames.bind(service),
    loadSheetData: service.loadSheetData.bind(service),
    
    // Configuration
    saveConfig: service.saveConfig.bind(service),
    loadConfig: service.loadConfig.bind(service),
    
    // Settings
    saveSettings: service.saveSettings.bind(service),
    loadSettings: service.loadSettings.bind(service),
    
    // Updates
    checkForUpdates: service.checkForUpdates.bind(service),
    installUpdate: service.installUpdate.bind(service),
    downloadUpdate: service.downloadUpdate.bind(service),
    
    // Window operations
    minimizeWindow: service.minimizeWindow.bind(service),
    maximizeWindow: service.maximizeWindow.bind(service),
    closeWindow: service.closeWindow.bind(service),
    
    // Downloads
    startDownloads: service.startDownloads.bind(service),
    cancelDownloads: service.cancelDownloads.bind(service),
    
    // Event management
    onDownloadProgress: service.onDownloadProgress.bind(service),
    onDownloadComplete: service.onDownloadComplete.bind(service),
    removeAllListeners: service.removeAllListeners.bind(service),
    cleanup: service.cleanup.bind(service),
  };
};