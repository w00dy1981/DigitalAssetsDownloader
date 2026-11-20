import { CONSTANTS } from './constants';
import type { UserSettings } from './types';

export const defaultUserSettings = {
  defaultPaths: {
    lastFileDialogPath: '',
    imageDownloadFolder: '',
    pdfDownloadFolder: '',
    sourceImageFolder: '',
    imageNetworkPath: '',
    pdfNetworkPath: '',
  },
  downloadBehavior: {
    defaultConcurrentDownloads: CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
    connectionTimeout: CONSTANTS.NETWORK.CONNECTION_TIMEOUT / 1000,
    readTimeout: CONSTANTS.NETWORK.READ_TIMEOUT / 1000,
    retryAttempts: CONSTANTS.DOWNLOAD.DEFAULT_RETRY_ATTEMPTS,
  },
  imageProcessing: {
    enabledByDefault: true,
    defaultMethod: 'smart_detect',
    defaultQuality: CONSTANTS.IMAGE.DEFAULT_QUALITY,
    defaultEdgeThreshold: CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
  },
  uiPreferences: {
    rememberFileDialogPath: true,
    showAdvancedOptions: false,
    startupTab: 'file',
  },
  updateSettings: {
    enableAutoUpdates: true,
    checkForUpdatesOnStartup: true,
    downloadUpdatesAutomatically: false,
  },
  sqlSettings: {
    defaultServer: '',
    defaultDatabase: CONSTANTS.SQL.DEFAULT_DATABASE,
    defaultUsername: CONSTANTS.SQL.DEFAULT_USERNAME,
    allowedCrossDatabases: ['WebScrapes'],
  },
} satisfies UserSettings;

type Settings = Required<UserSettings>;
type SavedFields<T> = { [Section in keyof T]?: Partial<T[Section]> };

function restoreDefaults<T extends Record<keyof T, object>>(
  defaults: T,
  saved: SavedFields<T>
): T {
  const settings = { ...saved, ...defaults };
  for (const section in defaults) {
    const fields = { ...defaults[section] };
    for (const field in fields) {
      fields[field] = saved[section]?.[field] ?? fields[field];
    }
    settings[section] = fields;
  }
  return settings;
}

export function mergeUserSettings(saved: SavedFields<Settings> = {}): Settings {
  return restoreDefaults<Settings>(defaultUserSettings, saved);
}
