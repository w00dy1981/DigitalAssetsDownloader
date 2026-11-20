import { useEffect, useState } from 'react';

export type UpdateNotice = { version: string; message: string } & (
  | { phase: 'available' | 'downloaded' }
  | { phase: 'downloading'; progress?: number }
);

export function useUpdateNotification() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const unsubscribe = [
      api.onUpdateChecking(() => {
        setNotice(
          current =>
            current && {
              version: current.version,
              phase:
                current.phase === 'downloaded' ? 'downloaded' : 'available',
              message: 'Checking for updates...',
            }
        );
      }),
      api.onUpdateAvailable(({ version }) => {
        setNotice({
          version,
          phase: 'available',
          message: 'Update available. Ready to download.',
        });
      }),
      api.onUpdateNotAvailable(() => setNotice(null)),
      api.onUpdateDownloadProgress(({ percent }) => {
        setNotice(
          current =>
            current && {
              version: current.version,
              phase: 'downloading',
              progress: percent,
              message: `Downloading update... ${Math.round(percent)}%`,
            }
        );
      }),
      api.onUpdateDownloaded(({ version }) => {
        setNotice({
          version,
          phase: 'downloaded',
          message: 'Update downloaded. Ready to install.',
        });
      }),
      api.onUpdateError(message => {
        setNotice(
          current =>
            current && {
              version: current.version,
              phase:
                current.phase === 'downloaded' ? 'downloaded' : 'available',
              message: `Update error: ${message}`,
            }
        );
        console.error('Auto-update error', new Error(message));
      }),
    ];

    return () => unsubscribe.forEach(off => off());
  }, []);

  async function download() {
    setNotice(
      current =>
        current && {
          version: current.version,
          phase: 'downloading',
          message: 'Starting update download...',
        }
    );
    try {
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setNotice(current =>
        current?.phase === 'downloading'
          ? {
              version: current.version,
              phase: 'available',
              message: `Download failed: ${failure.message}`,
            }
          : current
      );
      console.error('Update download failed', failure);
    }
  }

  async function install() {
    setNotice(
      current => current && { ...current, message: 'Installing update...' }
    );
    try {
      await window.electronAPI.installUpdate();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setNotice(
        current =>
          current && {
            ...current,
            message: `Install failed: ${failure.message}`,
          }
      );
      console.error('Update install failed', failure);
    }
  }

  return { notice, download, install, dismiss: () => setNotice(null) };
}
