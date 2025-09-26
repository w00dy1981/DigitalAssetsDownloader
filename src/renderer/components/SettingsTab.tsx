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
import { configurationService } from '@/services/ConfigurationService';
import { logger } from '@/services/LoggingService';

interface SettingsTabProps {
  onSettingsChange?: (settings: UserSettings) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ onSettingsChange }) => {
  // State for all settings
  const [settings, setSettings] = useState<UserSettings>(() =>
    configurationService.getDefaultUserSettings()
  );
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveStatus, showSaveStatus] = useStatusMessage();

  // Load settings on component mount
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const savedSettings = await configurationService.loadUserSettings();
        if (isMounted) {
          setSettings(savedSettings);
          setHasChanges(false);
          onSettingsChange?.(savedSettings);
        }
      } catch (error) {
        logger.error(
          'SettingsTab: Error loading settings',
          error instanceof Error ? error : new Error(String(error)),
          'SettingsTab'
        );
        showSaveStatus('Error loading settings', 2000);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [onSettingsChange, showSaveStatus]);

  // Save settings function
  const saveSettings = useCallback(async () => {
    try {
      const result = await configurationService.saveUserSettings(settings);

      if (result.success) {
        showSaveStatus(result.message, 2000);
        setHasChanges(false);
        onSettingsChange?.(settings);
      } else {
        showSaveStatus(result.message, 2000);
        logger.error(
          'SettingsTab: Error saving settings',
          new Error(result.message),
          'SettingsTab'
        );
      }
    } catch (error) {
      logger.error(
        'SettingsTab: Unexpected error saving settings',
        error instanceof Error ? error : new Error(String(error)),
        'SettingsTab'
      );
      showSaveStatus('Error saving settings', 2000);
    }
  }, [settings, onSettingsChange, showSaveStatus]);

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
    setSettings(configurationService.getDefaultUserSettings());
    setHasChanges(true);
  }, []);

  // Update setting helper
  const updateSetting = useCallback((path: string, value: unknown) => {
    setSettings(prev =>
      configurationService.updateUserSetting(prev, path, value)
    );
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
