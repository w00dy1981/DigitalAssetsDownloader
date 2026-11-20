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
