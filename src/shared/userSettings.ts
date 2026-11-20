export const defaultUserSettings = {
  defaultPaths: {
    imageDownloadFolder: '',
    pdfDownloadFolder: '',
    sourceImageFolder: '',
    imageNetworkPath: '',
  },
  downloadBehavior: {
    defaultConcurrentDownloads: 5,
    connectionTimeout: 5,
    readTimeout: 30,
    retryAttempts: 3,
  },
  imageProcessing: {
    enabledByDefault: true,
    defaultQuality: 95,
  },
  updateSettings: {
    enableAutoUpdates: true,
    checkForUpdatesOnStartup: true,
  },
  sqlSettings: {
    defaultServer: '',
    defaultDatabase: 'Baker',
    defaultUsername: 'DigitalAssetsDownloader',
  },
};

export type UserSettings = typeof defaultUserSettings;
type SavedFields<T> = { [Section in keyof T]?: Partial<T[Section]> };

function restoreDefaults<T extends Record<keyof T, object>>(
  defaults: T,
  saved: SavedFields<T>
): T {
  const settings = { ...defaults };
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
