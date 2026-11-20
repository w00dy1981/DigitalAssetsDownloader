import { ipcMain } from 'electron';
import Store from 'electron-store';
import {
  downloadConfigErrors,
  userSettingsErrors,
} from '@/shared/downloadSettings';
import { CONSTANTS } from '@/shared/constants';
import {
  IPC_CHANNELS,
  type AppConfig,
  type DownloadConfig,
  type NetworkPathDefaults,
  type SqlConnectionDetails,
  type UserSettings,
  type WindowState,
} from '@/shared/types';
import { mergeUserSettings } from '@/shared/userSettings';

export function registerConfiguration() {
  const store = new Store<AppConfig>({
    defaults: {
      windowState: {
        width: CONSTANTS.UI.DEFAULT_WINDOW_WIDTH,
        height: CONSTANTS.UI.DEFAULT_WINDOW_HEIGHT,
        isMaximized: false,
      },
      recentFiles: [],
    },
  });
  const getSettings = () => mergeUserSettings(store.get('userSettings'));

  ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_, config: DownloadConfig) => {
    const errors = downloadConfigErrors(config);
    if (errors.length)
      throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    store.set('lastConfiguration', config);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.LOAD_CONFIG, () => {
    const lastConfiguration = store.get('lastConfiguration');
    const sqlConnectionDetails = store.get('sqlConnectionDetails');
    if (!lastConfiguration && !sqlConnectionDetails) return null;
    return { lastConfiguration, sqlConnectionDetails };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_, settings: UserSettings) => {
    const errors = userSettingsErrors(settings);
    if (errors.length)
      throw new Error(`Invalid settings: ${errors.join(', ')}`);
    store.set('userSettings', mergeUserSettings(settings));
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.LOAD_SETTINGS, getSettings);

  ipcMain.handle(
    IPC_CHANNELS.SAVE_NETWORK_PATHS,
    (_, paths: NetworkPathDefaults) => {
      const { imageNetworkPath, pdfNetworkPath } = paths;
      if (
        typeof imageNetworkPath !== 'string' ||
        typeof pdfNetworkPath !== 'string'
      ) {
        throw new Error('Network paths must be text.');
      }

      const settings = getSettings();
      settings.defaultPaths.imageNetworkPath = imageNetworkPath;
      settings.defaultPaths.pdfNetworkPath = pdfNetworkPath;
      store.set('userSettings', settings);
    }
  );

  return {
    getSettings,
    getStartupUpdateSettings: () => store.get('userSettings')?.updateSettings,
    getWindowState: () => store.get('windowState'),
    saveWindowState: (state: WindowState) => store.set('windowState', state),
    recordRecentFile(filePath: string) {
      const recentFiles = store.get('recentFiles');
      store.set(
        'recentFiles',
        [filePath, ...recentFiles.filter(file => file !== filePath)].slice(
          0,
          10
        )
      );
    },
    rememberSqlConnection(details: SqlConnectionDetails) {
      store.set('sqlConnectionDetails', details);
    },
  };
}

export type DesktopConfiguration = ReturnType<typeof registerConfiguration>;
