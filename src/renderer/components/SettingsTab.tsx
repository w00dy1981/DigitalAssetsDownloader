import React, { useState, useEffect, useCallback } from 'react';
import { UserSettings } from '@/shared/types';
import { useStatusMessage } from '../hooks/useStatusMessage';
import {
  DefaultPathsSection,
  DownloadBehaviorSection,
  ImageProcessingSection,
  UIPreferencesSection,
  UpdateSettingsSection,
} from './settings';
import { CONSTANTS } from '@/shared/constants';

interface SettingsTabProps {
  onSettingsChange?: (settings: UserSettings) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ onSettingsChange }) => {
  // Default settings values
  const defaultSettings: UserSettings = {
    defaultPaths: {
      lastFileDialogPath: '',
      imageDownloadFolder: '',
      pdfDownloadFolder: '',
      sourceImageFolder: '',
      imageNetworkPath: '',
      pdfNetworkPath: '',
    },
    downloadBehavior: {
      defaultConcurrentDownloads: CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
      connectionTimeout: CONSTANTS.NETWORK.CONNECTION_TIMEOUT / 1000, // Convert to seconds
      readTimeout: CONSTANTS.NETWORK.READ_TIMEOUT / 1000, // Convert to seconds
      retryAttempts: CONSTANTS.DOWNLOAD.DEFAULT_RETRY_ATTEMPTS,
    },
    imageProcessing: {
      enabledByDefault: true,
      defaultMethod: 'smart_detect',
      defaultQuality: CONSTANTS.IMAGE.DEFAULT_QUALITY,
      defaultEdgeThreshold: CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
    },
    uiPreferences: {
      rememberFileDialogPath: true,
      showAdvancedOptions: false,
      startupTab: 'file',
    },
    updateSettings: {
      enableAutoUpdates: true,
      checkForUpdatesOnStartup: true,
      updateChannel: 'stable',
      downloadUpdatesAutomatically: false,
    },
  };

  // State for all settings
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveStatus, showSaveStatus] = useStatusMessage();

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await window.electronAPI.loadSettings();
        if (savedSettings) {
          // Merge with defaults to ensure all properties exist
          const mergedSettings = {
            ...defaultSettings,
            ...savedSettings,
            defaultPaths: {
              ...defaultSettings.defaultPaths,
              ...savedSettings.defaultPaths,
            },
            downloadBehavior: {
              ...defaultSettings.downloadBehavior,
              ...savedSettings.downloadBehavior,
            },
            imageProcessing: {
              ...defaultSettings.imageProcessing,
              ...savedSettings.imageProcessing,
            },
            uiPreferences: {
              ...defaultSettings.uiPreferences,
              ...savedSettings.uiPreferences,
            },
            updateSettings: {
              ...defaultSettings.updateSettings,
              ...savedSettings.updateSettings,
            },
          };
          setSettings(mergedSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings function
  const saveSettings = useCallback(async () => {
    try {
      await window.electronAPI.saveSettings(settings);
      showSaveStatus('Settings saved successfully', 2000);
      setHasChanges(false);
      onSettingsChange?.(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      showSaveStatus('Error saving settings', 2000);
    }
  }, [settings, onSettingsChange]);

  // Auto-save with debounce
  useEffect(() => {
    if (hasChanges) {
      const timeoutId = setTimeout(() => {
        saveSettings();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [settings, hasChanges, saveSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(true);
  }, []);

  // Update setting helper
  const updateSetting = useCallback((path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const pathParts = path.split('.');

      if (pathParts.length === 2) {
        const [section, key] = pathParts;
        if (section in newSettings) {
          (newSettings as any)[section] = {
            ...(newSettings as any)[section],
            [key]: value,
          };
        }
      }

      return newSettings;
    });
    setHasChanges(true);
  }, []);

  return (
    <div className="tab-content settings-tab">
      <div className="tab-header">
        <h2>Settings</h2>
        <div className="tab-actions">
          {saveStatus && (
            <span
              className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}
            >
              {saveStatus}
            </span>
          )}
          <button className="btn btn-secondary" onClick={resetToDefaults}>
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="configuration-sections">
        {/* First column - Default Paths, UI Preferences, and Update Settings */}
        <div className="default-paths">
          <DefaultPathsSection
            settings={settings}
            onSettingUpdate={updateSetting}
          />

          <UIPreferencesSection
            settings={settings}
            onSettingUpdate={updateSetting}
          />

          <UpdateSettingsSection
            settings={settings}
            onSettingUpdate={updateSetting}
          />
        </div>

        {/* Second column - Download Behavior and Image Processing */}
        <div className="other-settings">
          <DownloadBehaviorSection
            settings={settings}
            onSettingUpdate={updateSetting}
          />

          <ImageProcessingSection
            settings={settings}
            onSettingUpdate={updateSetting}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
