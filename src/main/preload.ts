import { contextBridge, ipcRenderer } from 'electron';
import type {
  IpcRendererEvent,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import type {
  SqlConnectionDetails,
  SqlConnectionRequest,
  SqlCredentialIdentity,
  SqlPasswordDeleteRequest,
  SqlPasswordSaveRequest,
  SqlQueryRequest,
  SqlQueryResult,
} from '@/sql/contracts';
import {
  IPC_CHANNELS as channels,
  type LoadedInput,
  type UpdateCheckResult,
} from '@/shared/types';
import type { UserSettings } from '@/shared/userSettings';
import type {
  DownloadOptions,
  DownloadCompletionEvent,
  DownloadProgress,
} from '@/download/downloadRun';

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.match(
        /^Error invoking remote method '[^']+': (?:Error: )?(.+)$/s
      );
      if (message) throw new Error(message[1]);
    }
    throw error;
  }
}

function subscribe<T>(channel: string, callback: (data: T) => void) {
  const listener = (_event: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

type Success = { success: true };

const electronAPI = {
  openFileDialog: () =>
    invoke<OpenDialogReturnValue>(channels.OPEN_FILE_DIALOG),
  openFolderDialog: (options?: OpenDialogOptions) =>
    invoke<OpenDialogReturnValue>(channels.OPEN_FOLDER_DIALOG, options),
  getSheetNames: (filePath: string) =>
    invoke<string[]>(channels.GET_SHEET_NAMES, filePath),
  loadSheetData: (filePath: string, sheetName: string) =>
    invoke<LoadedInput>(channels.LOAD_SHEET_DATA, filePath, sheetName),

  testSqlConnection: (request: SqlConnectionRequest) =>
    invoke<Success>(channels.TEST_SQL_CONNECTION, request),
  previewSqlQuery: (request: SqlQueryRequest) =>
    invoke<SqlQueryResult>(channels.PREVIEW_SQL_QUERY, request),
  loadSqlQueryData: (request: SqlQueryRequest) =>
    invoke<LoadedInput>(channels.LOAD_SQL_QUERY_DATA, request),
  loadSavedSqlPassword: (identity: SqlCredentialIdentity) =>
    invoke<string | null>(channels.LOAD_SAVED_SQL_PASSWORD, identity),
  saveSqlPassword: (request: SqlPasswordSaveRequest) =>
    invoke<Success>(channels.SAVE_SQL_PASSWORD, request),
  deleteSavedSqlPassword: (request: SqlPasswordDeleteRequest) =>
    invoke<Success>(channels.DELETE_SAVED_SQL_PASSWORD, request),

  loadSqlConnectionDetails: () =>
    invoke<SqlConnectionDetails>(channels.LOAD_SQL_CONNECTION_DETAILS),
  saveImageNetworkPath: (path: string) =>
    invoke<void>(channels.SAVE_IMAGE_NETWORK_PATH, path),
  saveSettings: (settings: UserSettings) =>
    invoke<Success>(channels.SAVE_SETTINGS, settings),
  loadSettings: () => invoke<UserSettings>(channels.LOAD_SETTINGS),

  checkForUpdates: () => invoke<UpdateCheckResult>(channels.CHECK_FOR_UPDATES),
  installUpdate: () => invoke<void>(channels.INSTALL_UPDATE),
  downloadUpdate: () =>
    invoke<string[] | { skipped: true }>(channels.DOWNLOAD_UPDATE),

  startDownloads: (config: DownloadOptions, loadId: LoadedInput['loadId']) =>
    invoke<void>(channels.START_DOWNLOADS, config, loadId),
  cancelDownloads: () => invoke<void>(channels.CANCEL_DOWNLOADS),

  onDownloadProgress: (callback: (data: DownloadProgress) => void) =>
    subscribe(channels.DOWNLOAD_PROGRESS, callback),
  onDownloadComplete: (callback: (data: DownloadCompletionEvent) => void) =>
    subscribe(channels.DOWNLOAD_COMPLETE, callback),
  onMenuOpenFile: (callback: () => void) =>
    subscribe(channels.MENU_OPEN_FILE, callback),
  onMenuOpenSettings: (callback: () => void) =>
    subscribe(channels.MENU_OPEN_SETTINGS, callback),
  onUpdateChecking: (callback: () => void) =>
    subscribe(channels.UPDATE_CHECKING, callback),
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) =>
    subscribe(channels.UPDATE_AVAILABLE, callback),
  onUpdateNotAvailable: (
    callback: (
      info: UpdateInfo | { version: string; reason: 'auto-update-disabled' }
    ) => void
  ) => subscribe(channels.UPDATE_NOT_AVAILABLE, callback),
  onUpdateError: (callback: (error: string) => void) =>
    subscribe(channels.UPDATE_ERROR, callback),
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) =>
    subscribe(channels.UPDATE_DOWNLOADED, callback),
  onUpdateDownloadProgress: (callback: (progress: ProgressInfo) => void) =>
    subscribe(channels.UPDATE_DOWNLOAD_PROGRESS, callback),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
