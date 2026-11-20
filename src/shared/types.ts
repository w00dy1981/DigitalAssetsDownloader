import type { UserSettings } from './userSettings';
import type { DownloadOptions } from '../download/downloadRun';
import type { SqlConnectionDetails } from '@/sql/contracts';
import type { UpdateInfo } from 'electron-updater';

export const spreadsheetExtensions = ['xlsx', 'xlsm', 'csv'];

export interface LoadedInput {
  loadId: number;
  columns: string[];
  rowCount: number;
  sheetName: string;
  options: DownloadOptions;
  sourceLabel: string;
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
  EXECUTE_SQL_QUERY: 'execute-sql-query',
  SELECT_SQL_RESULT: 'select-sql-result',
  LOAD_SAVED_SQL_PASSWORD: 'load-saved-sql-password',
  SAVE_SQL_PASSWORD: 'save-sql-password',
  DELETE_SAVED_SQL_PASSWORD: 'delete-saved-sql-password',

  // Configuration
  LOAD_SQL_CONNECTION_DETAILS: 'load-sql-connection-details',

  MENU_OPEN_FILE: 'menu-open-file',
  MENU_OPEN_SETTINGS: 'menu-open-settings',

  // Download operations
  START_DOWNLOADS: 'start-downloads',
  CANCEL_DOWNLOADS: 'cancel-downloads',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_COMPLETE: 'download-complete',

  // Settings operations
  SAVE_IMAGE_NETWORK_PATH: 'save-image-network-path',
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
  DOWNLOAD_UPDATE: 'download-update',
} as const;
