import type { UserSettings } from './userSettings';
import type { DownloadOptions } from '../download/downloadRun';
import type { SqlConnectionDetails } from '@/sql/contracts';
import type { UpdateInfo } from 'electron-updater';

export interface SpreadsheetData {
  columns: string[];
  rows: Record<string, any>[];
  sheetName: string;
  filePath: string;
  sourceType?: 'file' | 'sql';
  sourceLabel?: string;
}

export interface DownloadConfig extends DownloadOptions {
  excelFile: string;
  sheetName: string;
  sourceType?: 'file' | 'sql';
  sourceLabel?: string;
  pdfFilePath: string; // Network path for CSV logging (user-configurable in Settings)
  backgroundProcessing: DownloadOptions['backgroundProcessing'] & {
    method: 'smart_detect';
    edgeThreshold: number;
  };
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

export type UpdateCheckResult =
  | { type: 'available' | 'not-available'; data: UpdateInfo }
  | { type: 'error'; data: string }
  | { type: 'auto-update-disabled' };

export interface AppConfig {
  windowState: WindowState;
  lastConfiguration?: DownloadConfig;
  userSettings?: UserSettings;
  sqlConnectionDetails?: SqlConnectionDetails;
}

// IPC Channel names for communication between main and renderer
export const IPC_CHANNELS = {
  // File operations
  OPEN_FILE_DIALOG: 'open-file-dialog',
  OPEN_FOLDER_DIALOG: 'open-folder-dialog',

  // Excel operations
  GET_SHEET_NAMES: 'get-sheet-names',
  LOAD_SHEET_DATA: 'load-sheet-data',

  // SQL Server operations
  TEST_SQL_CONNECTION: 'test-sql-connection',
  PREVIEW_SQL_QUERY: 'preview-sql-query',
  LOAD_SQL_QUERY_DATA: 'load-sql-query-data',
  LOAD_SAVED_SQL_PASSWORD: 'load-saved-sql-password',
  SAVE_SQL_PASSWORD: 'save-sql-password',
  DELETE_SAVED_SQL_PASSWORD: 'delete-saved-sql-password',

  // Configuration
  SAVE_CONFIG: 'save-config',
  LOAD_CONFIG: 'load-config',

  MENU_OPEN_FILE: 'menu-open-file',
  MENU_SAVE_CONFIG: 'menu-save-config',
  MENU_OPEN_SETTINGS: 'menu-open-settings',

  // Download operations
  START_DOWNLOADS: 'start-downloads',
  CANCEL_DOWNLOADS: 'cancel-downloads',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_COMPLETE: 'download-complete',

  // Settings operations
  SAVE_SETTINGS: 'save-settings',
  SAVE_NETWORK_PATHS: 'save-network-paths',
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
  DOWNLOAD_UPDATE: 'download-update',
} as const;
