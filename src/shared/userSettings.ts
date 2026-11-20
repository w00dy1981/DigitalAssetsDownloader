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
    defaultConcurrentDownloads: 5,
    connectionTimeout: 5,
    readTimeout: 30,
    retryAttempts: 3,
  },
  imageProcessing: {
    enabledByDefault: true,
    defaultMethod: 'smart_detect' as const,
    defaultQuality: 95,
    defaultEdgeThreshold: 30,
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
    defaultDatabase: 'Baker',
    defaultUsername: 'DigitalAssetsDownloader',
    allowedCrossDatabases: ['WebScrapes'],
  },
};

export type UserSettings = typeof defaultUserSettings;
export type NetworkPathDefaults = Pick<
  UserSettings['defaultPaths'],
  'imageNetworkPath' | 'pdfNetworkPath'
>;

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

export function mergeUserSettings(
  saved: SavedFields<UserSettings> = {}
): UserSettings {
  return restoreDefaults<UserSettings>(defaultUserSettings, saved);
}
