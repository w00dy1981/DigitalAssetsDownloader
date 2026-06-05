// Shared TypeScript interfaces for Digital Asset Downloader
// Based on original Python app configuration schema (Lines 1200-1225)

export interface SpreadsheetData {
  columns: string[];
  rows: Record<string, any>[];
  sheetName: string;
  filePath: string;
  sourceType?: 'file' | 'sql';
  sourceLabel?: string;
}

export interface DownloadConfig {
  excelFile: string;
  sheetName: string;
  sourceType?: 'file' | 'sql';
  sourceLabel?: string;
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
    method: 'smart_detect';
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

export interface DownloadCompletionEvent {
  successful: number;
  failed: number;
  total: number;
  backgroundProcessed: number;
  logFile?: string;
  cancelled?: boolean;
  error?: string;
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
  cancelled?: boolean;
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
    defaultMethod: 'smart_detect';
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
    downloadUpdatesAutomatically: boolean; // Auto-download vs prompt user
  };
  // Enhanced configuration options (Issue #23)
  advanced?: {
    // Network timeout configurations
    networkTimeouts?: {
      connectionTimeout?: number; // Override default connection timeout
      readTimeout?: number; // Override default read timeout
      updateCheckTimeout?: number; // Override default update check timeout
      excelTimeout?: number; // Override default Excel loading timeout
    };
    // UI configuration
    windowSettings?: {
      defaultWidth?: number; // Override default window width
      defaultHeight?: number; // Override default window height
      statusMessageDuration?: number; // Override status message display duration
    };
    // Image processing overrides
    imageDefaults?: {
      qualityOverride?: number; // Override default JPEG quality
      edgeThresholdOverride?: number; // Override default edge threshold
    };
  };
}

export interface SqlConnectionDetails {
  server: string;
  database: string;
  username: string;
}

export type SqlCredentialIdentity = SqlConnectionDetails;

export interface SqlPasswordSaveRequest {
  identity: SqlCredentialIdentity;
  password: string;
}

export interface SqlPasswordDeleteRequest {
  identity: SqlCredentialIdentity;
}

export interface SqlConnectionTestRequest extends SqlConnectionDetails {
  password: string;
  queryTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

export interface SqlQueryRequest extends SqlConnectionTestRequest {
  query: string;
  rowLimit?: number;
}

export interface SqlPreviewRequest extends SqlQueryRequest {
  rowLimit: number;
}

export interface SqlLoadRequest extends SqlQueryRequest {
  rowLimit: number;
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  sourceLabel: string;
}

export interface AppConfig {
  windowState: WindowState;
  lastConfiguration?: DownloadConfig;
  recentFiles: string[];
  userSettings?: UserSettings;
  sqlConnectionDetails?: SqlConnectionDetails;
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

  // SQL Server operations
  TEST_SQL_CONNECTION: 'test-sql-connection',
  PREVIEW_SQL_QUERY: 'preview-sql-query',
  LOAD_SQL_QUERY_DATA: 'load-sql-query-data',
  LOAD_SAVED_SQL_PASSWORD: 'load-saved-sql-password',
  SAVE_SQL_PASSWORD: 'save-sql-password',
  DELETE_SAVED_SQL_PASSWORD: 'delete-saved-sql-password',
  HAS_SAVED_SQL_PASSWORD: 'has-saved-sql-password',

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
  UPDATE_CHECKING: 'update-checking',
  UPDATE_AVAILABLE: 'update-available',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  UPDATE_DOWNLOADED: 'update-downloaded',
  UPDATE_DOWNLOAD_PROGRESS: 'update-download-progress',
  UPDATE_ERROR: 'update-error',
  INSTALL_UPDATE: 'install-update',
} as const;

export type IpcChannelType = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
