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
  imageFilePath: string; // Network path for logging (default: "U:\\old_g\\IMAGES\\ABM Product Images")
  pdfFilePath: string; // Network path for logging (default: "U:\\old_g\\IMAGES\\Product pdf\\'s")
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

export interface AppConfig {
  windowState: WindowState;
  lastConfiguration?: DownloadConfig;
  recentFiles: string[];
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
} as const;

export type IpcChannelType = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
