import type { SqlConnectionDetails } from '@/sql/contracts';
import { ipcMain } from 'electron';
import Store from 'electron-store';
import { userSettingsErrors } from '@/shared/downloadSettings';
import { IPC_CHANNELS, type AppConfig, type WindowState } from '@/shared/types';
import type { UserSettings } from '@/shared/userSettings';
import { mergeUserSettings } from '@/shared/userSettings';

export function registerConfiguration() {
  const store = new Store<AppConfig>({
    defaults: {
      windowState: {
        width: 1200,
        height: 800,
        isMaximized: false,
      },
    },
  });
  const getSettings = () => mergeUserSettings(store.get('userSettings'));

  ipcMain.handle(
    IPC_CHANNELS.LOAD_SQL_CONNECTION_DETAILS,
    (): SqlConnectionDetails => {
      const saved = store.get('sqlConnectionDetails');
      const defaults = getSettings().sqlSettings;
      return {
        server: saved?.server || defaults.defaultServer,
        database: saved?.database ?? defaults.defaultDatabase,
        username: saved?.username || defaults.defaultUsername,
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_, settings: UserSettings) => {
    const errors = userSettingsErrors(settings);
    if (errors.length)
      throw new Error(`Invalid settings: ${errors.join(', ')}`);
    const previous = store.get('userSettings');
    const active = mergeUserSettings(settings);
    store.set('userSettings', {
      ...previous,
      ...active,
      // Older versions stored additional folder and image preferences.
      defaultPaths: { ...previous?.defaultPaths, ...active.defaultPaths },
      imageProcessing: {
        ...previous?.imageProcessing,
        ...active.imageProcessing,
      },
    });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.LOAD_SETTINGS, getSettings);
  ipcMain.handle(IPC_CHANNELS.SAVE_IMAGE_NETWORK_PATH, (_, path: string) => {
    if (typeof path !== 'string')
      throw new Error('Image network path must be text.');
    store.set('userSettings.defaultPaths.imageNetworkPath', path);
  });

  return {
    getSettings,
    getStartupUpdateSettings: () => store.get('userSettings')?.updateSettings,
    getWindowState: () => store.get('windowState'),
    saveWindowState: (state: WindowState) => store.set('windowState', state),
    rememberSqlConnection(details: SqlConnectionDetails) {
      store.set('sqlConnectionDetails', {
        server: details.server.trim(),
        database: details.database.trim(),
        username: details.username.trim(),
      });
    },
  };
}

export type DesktopConfiguration = ReturnType<typeof registerConfiguration>;
