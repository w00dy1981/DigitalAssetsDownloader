import { defaultUserSettings, mergeUserSettings } from './userSettings';

test('fills missing fields in older settings and keeps saved preferences', () => {
  const settings = mergeUserSettings({
    defaultPaths: { imageNetworkPath: '\\\\files\\images' },
    updateSettings: { enableAutoUpdates: false },
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
  expect(settings.sqlSettings).toEqual(defaultUserSettings.sqlSettings);
});

test('restores SQL preferences without old database restrictions or credentials', () => {
  const saved = {
    sqlSettings: {
      defaultUsername: 'reader',
      allowedCrossDatabases: ['old'],
      password: 'fixture',
    },
  };
  const settings = mergeUserSettings(saved);
  expect(settings.sqlSettings).toEqual({
    ...defaultUserSettings.sqlSettings,
    defaultUsername: 'reader',
  });
});

test('restores active paths and image options from older settings', () => {
  const saved = {
    defaultPaths: {
      imageNetworkPath: '/shared/images',
      pdfDownloadFolder: '/downloads/pdfs',
      pdfNetworkPath: '/shared/pdfs',
    },
    uiPreferences: { startupTab: 'file' },
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
  expect(settings).not.toHaveProperty('uiPreferences');
  expect(settings.imageProcessing).toEqual({
    enabledByDefault: false,
    defaultQuality: 82,
  });
});
