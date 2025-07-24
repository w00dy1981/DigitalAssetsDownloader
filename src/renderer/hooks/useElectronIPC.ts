import { useCallback } from 'react';

export const useElectronIPC = () => {
  const saveSettings = useCallback(async (settings: any) => {
    return await window.electronAPI.saveSettings(settings);
  }, []);

  const loadSettings = useCallback(async () => {
    return await window.electronAPI.loadSettings();
  }, []);

  const saveConfig = useCallback(async (config: any) => {
    return await window.electronAPI.saveConfig(config);
  }, []);

  const checkForUpdates = useCallback(async () => {
    return await window.electronAPI.checkForUpdates();
  }, []);

  return {
    saveSettings,
    loadSettings,
    saveConfig,
    checkForUpdates,
  };
};