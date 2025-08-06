// Shared TypeScript interfaces for Digital Asset Downloader
// Based on original Python app configuration schema (Lines 1200-1225)

export interface SpreadsheetData {
  columns: string[];
  rows: Record<string, any>[];
  sheetName: string;
  filePath: string;
}

export interface DownloadConfig {
  excelFile: string;
  sheetName: string;
  partNoColumn: string;
  imageColumns: string[];
  pdfColumn: string;
  filenameColumn: string; // Key feature for source folder search
  imageFolder: string;
  pdfFolder: string;
  sourceImageFolder: string;
  imageFilePath: string; // Network path for CSV logging (user-configurable in Settings)
  pdfFilePath: string; // Network path for CSV logging (user-configurable in Settings)
  maxWorkers: number;
  backgroundProcessing: {
    enabled: boolean;
    method: 'smart_detect' | 'ai_removal' | 'color_replace' | 'edge_detection';
    quality: number;
    edgeThreshold: number;
  };
}

export interface DownloadItem {
  rowNumber: number;
  partNumber: string;
  urls: string[];
  pdfUrl?: string;
  customFilename?: string;
  sourceFolder?: string;
}

export interface DownloadProgress {
  currentFile: string;
  successful: number;
  failed: number;
  total: number;
  percentage: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  backgroundProcessed: number; // Count of images that had background processing applied
}

export interface DownloadResult {
  success: boolean;
  url: string;
  filePath: string;
  networkPath: string;
  error?: string;
  httpStatus?: number;
  contentType?: string;
  fileSize?: number;
  backgroundProcessed: boolean;
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

export interface UserSettings {
  defaultPaths: {
    lastFileDialogPath: string;
    imageDownloadFolder: string; // Default download folder for images
    pdfDownloadFolder: string; // Default download folder for PDFs
    sourceImageFolder: string; // Default source folder for searching
    imageNetworkPath: string; // Default network path for image logging
    pdfNetworkPath: string; // Default network path for PDF logging
  };
  downloadBehavior: {
    defaultConcurrentDownloads: number; // Default worker count (1-20)
    connectionTimeout: number; // Default connection timeout (5s)
    readTimeout: number; // Default read timeout (30s)
    retryAttempts: number; // Default retry count (3)
  };
  imageProcessing: {
    enabledByDefault: boolean; // Background processing on/off by default
    defaultMethod:
      | 'smart_detect'
      | 'ai_removal'
      | 'color_replace'
      | 'edge_detection';
    defaultQuality: number; // JPEG quality (60-100%)
    defaultEdgeThreshold: number; // Edge detection threshold
  };
  uiPreferences: {
    rememberFileDialogPath: boolean; // Enable/disable file dialog path memory
    showAdvancedOptions: boolean; // Show/hide advanced configuration options
    startupTab: 'file' | 'column' | 'process' | 'settings'; // Default tab on startup
  };
  updateSettings: {
    enableAutoUpdates: boolean; // Enable/disable automatic updates
    checkForUpdatesOnStartup: boolean; // Check for updates when app starts
    updateChannel: 'stable' | 'beta'; // Update channel preference
    downloadUpdatesAutomatically: boolean; // Auto-download vs prompt user
  };
}

export interface AppConfig {
  windowState: WindowState;
  lastConfiguration?: DownloadConfig;
  recentFiles: string[];
  userSettings?: UserSettings;
}

// IPC Channel names for communication between main and renderer
export const IPC_CHANNELS = {
  // File operations
  OPEN_FILE_DIALOG: 'open-file-dialog',
  OPEN_FOLDER_DIALOG: 'open-folder-dialog',
  SAVE_FILE_DIALOG: 'save-file-dialog',

  // Excel operations
  LOAD_EXCEL_FILE: 'load-excel-file',
  GET_SHEET_NAMES: 'get-sheet-names',
  LOAD_SHEET_DATA: 'load-sheet-data',

  // Configuration
  SAVE_CONFIG: 'save-config',
  LOAD_CONFIG: 'load-config',

  // Window operations
  MINIMIZE_WINDOW: 'minimize-window',
  MAXIMIZE_WINDOW: 'maximize-window',
  CLOSE_WINDOW: 'close-window',

  // Download operations
  START_DOWNLOADS: 'start-downloads',
  CANCEL_DOWNLOADS: 'cancel-downloads',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_COMPLETE: 'download-complete',

  // Settings operations
  SAVE_SETTINGS: 'save-settings',
  LOAD_SETTINGS: 'load-settings',

  // Auto-updater operations
  CHECK_FOR_UPDATES: 'check-for-updates',
  UPDATE_AVAILABLE: 'update-available',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  UPDATE_DOWNLOADED: 'update-downloaded',
  UPDATE_DOWNLOAD_PROGRESS: 'update-download-progress',
  INSTALL_UPDATE: 'install-update',
} as const;

export type IpcChannelType = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
