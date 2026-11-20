import React, { useState, useEffect } from 'react';
import { UserSettings } from '@/shared/types';
import { useStatusMessage } from '../hooks/useStatusMessage';
import {
  DefaultPathsSection,
  DownloadBehaviorSection,
  ImageProcessingSection,
  SqlSettingsSection,
  UIPreferencesSection,
  UpdateSettingsSection,
} from './settings';
import { defaultUserSettings } from '@/shared/userSettings';
import { logger } from '@/services/LoggingService';

const SettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveStatus, showSaveStatus] = useStatusMessage();

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const saved = await window.electronAPI.loadSettings();
        if (active) setSettings(saved);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          'Error loading settings',
          new Error(message),
          'SettingsTab'
        );
        if (active) setLoadFailed(true);
      }
    };
    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  async function save(next: UserSettings) {
    setSettings(next);
    try {
      await window.electronAPI.saveSettings(next);
      showSaveStatus('Settings saved successfully', 2000);
    } catch (error) {
      showSaveStatus(
        `Error saving settings: ${error instanceof Error ? error.message : String(error)}`,
        2000
      );
    }
  }

  const resetToDefaults = () => {
    void save(defaultUserSettings);
  };

  const updateSetting = <Section extends keyof UserSettings>(
    section: Section,
    changes: Partial<NonNullable<UserSettings[Section]>>
  ) => {
    if (!settings) return;
    void save({
      ...settings,
      [section]: { ...settings[section], ...changes },
    });
  };

  if (!settings) {
    return (
      <div className="settings-tab">
        {loadFailed ? 'Error loading settings' : 'Loading settings...'}
      </div>
    );
  }

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
            onSettingUpdate={changes => updateSetting('defaultPaths', changes)}
          />

          <UIPreferencesSection
            settings={settings}
            onSettingUpdate={changes => updateSetting('uiPreferences', changes)}
          />

          <UpdateSettingsSection
            settings={settings}
            onSettingUpdate={changes =>
              updateSetting('updateSettings', changes)
            }
          />
        </div>

        {/* Second column - Download Behavior, Image Processing, and SQL Server Defaults */}
        <div className="other-settings">
          <DownloadBehaviorSection
            settings={settings}
            onSettingUpdate={changes =>
              updateSetting('downloadBehavior', changes)
            }
          />

          <ImageProcessingSection
            settings={settings}
            onSettingUpdate={changes =>
              updateSetting('imageProcessing', changes)
            }
          />

          <SqlSettingsSection
            settings={settings}
            onSettingUpdate={changes => updateSetting('sqlSettings', changes)}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
