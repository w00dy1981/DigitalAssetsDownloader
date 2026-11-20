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

type SavedUserSettings = {
  [Section in keyof UserSettings]?: Partial<NonNullable<UserSettings[Section]>>;
};

export function mergeUserSettings(
  savedSettings: SavedUserSettings = {}
): UserSettings {
  return {
    ...defaultUserSettings,
    ...savedSettings,
    defaultPaths: {
      ...defaultUserSettings.defaultPaths,
      ...savedSettings.defaultPaths,
    },
    downloadBehavior: {
      ...defaultUserSettings.downloadBehavior,
      ...savedSettings.downloadBehavior,
    },
    imageProcessing: {
      ...defaultUserSettings.imageProcessing,
      ...savedSettings.imageProcessing,
    },
    uiPreferences: {
      ...defaultUserSettings.uiPreferences,
      ...savedSettings.uiPreferences,
    },
    updateSettings: {
      ...defaultUserSettings.updateSettings,
      ...savedSettings.updateSettings,
    },
    sqlSettings: {
      defaultServer:
        savedSettings.sqlSettings?.defaultServer ??
        defaultUserSettings.sqlSettings.defaultServer,
      defaultDatabase:
        savedSettings.sqlSettings?.defaultDatabase ??
        defaultUserSettings.sqlSettings.defaultDatabase,
      defaultUsername:
        savedSettings.sqlSettings?.defaultUsername ??
        defaultUserSettings.sqlSettings.defaultUsername,
      allowedCrossDatabases:
        savedSettings.sqlSettings?.allowedCrossDatabases ??
        defaultUserSettings.sqlSettings.allowedCrossDatabases,
    },
  };
}
