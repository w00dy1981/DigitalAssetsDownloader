import { defaultUserSettings, mergeUserSettings } from './userSettings';

test('fills missing fields in older settings and keeps saved preferences', () => {
  const settings = mergeUserSettings({
    defaultPaths: { imageNetworkPath: '\\\\files\\images' },
    updateSettings: { enableAutoUpdates: false },
    sqlSettings: { allowedCrossDatabases: [] },
  });

  expect(settings.defaultPaths).toEqual({
    ...defaultUserSettings.defaultPaths,
    imageNetworkPath: '\\\\files\\images',
  });
  expect(settings.downloadBehavior).toEqual(
    defaultUserSettings.downloadBehavior
  );
  expect(settings.updateSettings.enableAutoUpdates).toBe(false);
  expect(settings.updateSettings.checkForUpdatesOnStartup).toBe(true);
  expect(settings.sqlSettings).toEqual({
    ...defaultUserSettings.sqlSettings,
    allowedCrossDatabases: [],
  });
});

test('keeps credentials out of restored SQL preferences', () => {
  const saved = {
    sqlSettings: { defaultUsername: 'reader', password: 'fixture' },
  };
  const settings = mergeUserSettings(saved);
  expect(settings.sqlSettings.defaultUsername).toBe('reader');
  expect(settings.sqlSettings).not.toHaveProperty('password');
});

test('restores active paths and image options from older settings', () => {
  const saved = {
    defaultPaths: {
      imageNetworkPath: '/shared/images',
      pdfDownloadFolder: '/downloads/pdfs',
      pdfNetworkPath: '/shared/pdfs',
    },
    imageProcessing: {
      enabledByDefault: false,
      defaultQuality: 82,
      defaultMethod: 'smart_detect',
      defaultEdgeThreshold: 30,
    },
  };

  const settings = mergeUserSettings(saved);
  expect(settings.defaultPaths).toEqual({
    ...defaultUserSettings.defaultPaths,
    imageNetworkPath: '/shared/images',
    pdfDownloadFolder: '/downloads/pdfs',
  });
  expect(settings.imageProcessing).toEqual({
    enabledByDefault: false,
    defaultQuality: 82,
  });
});
