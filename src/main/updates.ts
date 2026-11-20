import { app, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS, UpdateCheckResult } from '@/shared/types';
import type { UserSettings } from '@/shared/userSettings';

export function registerUpdates(
  send: (channel: string, payload?: unknown) => void,
  settings?: UserSettings['updateSettings']
) {
  const enabled = existsSync(join(process.resourcesPath, 'app-update.yml'));
  log.transports.file.maxSize = 5 * 1024 * 1024;
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () =>
    send(IPC_CHANNELS.UPDATE_CHECKING)
  );
  autoUpdater.on('update-available', info =>
    send(IPC_CHANNELS.UPDATE_AVAILABLE, info)
  );
  autoUpdater.on('update-not-available', info =>
    send(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, info)
  );
  autoUpdater.on('error', error =>
    send(IPC_CHANNELS.UPDATE_ERROR, error.message)
  );
  autoUpdater.on('download-progress', progress =>
    send(IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS, progress)
  );
  autoUpdater.on('update-downloaded', info =>
    send(IPC_CHANNELS.UPDATE_DOWNLOADED, info)
  );

  ipcMain.handle(
    IPC_CHANNELS.CHECK_FOR_UPDATES,
    async (): Promise<UpdateCheckResult> => {
      if (!enabled) {
        send(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, {
          version: app.getVersion(),
          reason: 'auto-update-disabled',
        });
        return { type: 'auto-update-disabled' };
      }
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          autoUpdater.checkForUpdates(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Update check timed out')),
              30_000
            );
          }),
        ]);
        if (!result) throw new Error('Update check returned no result');
        return {
          type: result.isUpdateAvailable ? 'available' : 'not-available',
          data: result.updateInfo,
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  );
  ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, () => {
    if (enabled) autoUpdater.quitAndInstall();
  });
  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_UPDATE, () =>
    enabled ? autoUpdater.downloadUpdate() : { skipped: true }
  );

  if (
    enabled &&
    settings?.enableAutoUpdates &&
    settings.checkForUpdatesOnStartup
  ) {
    setTimeout(() => {
      void autoUpdater
        .checkForUpdatesAndNotify()
        .catch(error => log.warn('Startup update check failed', error));
    }, 3000);
  }
}
