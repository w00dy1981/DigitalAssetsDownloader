import { useCallback } from 'react';
import { ipcService } from '@/services/IPCService';
import { UserSettings, DownloadConfig } from '@/shared/types';

/**
 * Legacy useElectronIPC hook - now powered by IPCService
 * Maintained for backward compatibility with existing components
 * 
 * New components should use useIPCService from IPCService.ts for full functionality
 */
export const useElectronIPC = () => {
  const saveSettings = useCallback(async (settings: UserSettings) => {
    return await ipcService.saveSettings(settings);
  }, []);

  const loadSettings = useCallback(async () => {
    return await ipcService.loadSettings();
  }, []);

  const saveConfig = useCallback(async (config: DownloadConfig) => {
    return await ipcService.saveConfig(config);
  }, []);

  const checkForUpdates = useCallback(async () => {
    return await ipcService.checkForUpdates();
  }, []);

  return {
    saveSettings,
    loadSettings,
    saveConfig,
    checkForUpdates,
  };
};