import React, { useState } from 'react';
import { UserSettings } from '@/shared/types';
import { useStatusMessage } from '@/renderer/hooks';
import { UI_CONSTANTS } from '@/shared/constants';
import { logger } from '@/services/LoggingService';

interface UpdateSettingsSectionProps {
  settings: UserSettings;
  onSettingUpdate: (changes: Partial<UserSettings['updateSettings']>) => void;
}

export const UpdateSettingsSection: React.FC<UpdateSettingsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateStatus, showUpdateStatus] = useStatusMessage();

  const checkForUpdatesManually = async () => {
    setIsCheckingForUpdates(true);
    showUpdateStatus('Checking for updates...');
    const duration = UI_CONSTANTS.STATUS_MESSAGE_DURATION;

    try {
      const result = await window.electronAPI.checkForUpdates();
      switch (result.type) {
        case 'available':
          showUpdateStatus(
            `Update available: v${result.data.version}`,
            duration
          );
          break;
        case 'not-available':
          showUpdateStatus('You are running the latest version', duration);
          break;
        case 'auto-update-disabled':
          showUpdateStatus('Updates are unavailable in this build.', duration);
          break;
        case 'error':
          showUpdateStatus(`Update check failed: ${result.data}`, duration);
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showUpdateStatus(`Update check failed: ${message}`, duration);
      logger.error('Update check failed', new Error(message), 'UpdateSettings');
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  return (
    <div className="config-section">
      <h3>Update Settings</h3>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.updateSettings.enableAutoUpdates}
            onChange={e =>
              onSettingUpdate({ enableAutoUpdates: e.target.checked })
            }
          />
          Enable automatic updates
        </label>
        <small className="text-muted">
          Allow the application to automatically check for and install updates
        </small>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.updateSettings.checkForUpdatesOnStartup}
            onChange={e =>
              onSettingUpdate({ checkForUpdatesOnStartup: e.target.checked })
            }
            disabled={!settings.updateSettings.enableAutoUpdates}
          />
          Check for updates on startup
        </label>
        <small className="text-muted">
          Automatically check for updates when the application starts
        </small>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.updateSettings.downloadUpdatesAutomatically}
            onChange={e =>
              onSettingUpdate({
                downloadUpdatesAutomatically: e.target.checked,
              })
            }
            disabled={!settings.updateSettings.enableAutoUpdates}
          />
          Download updates automatically
        </label>
        <small className="text-muted">
          Download updates in background vs. prompting user first
        </small>
      </div>

      <div className="form-group">
        <button
          className={`btn btn-primary ${isCheckingForUpdates ? 'loading' : ''}`}
          onClick={checkForUpdatesManually}
          disabled={isCheckingForUpdates}
          style={{ marginRight: '10px' }}
        >
          {isCheckingForUpdates ? 'Checking...' : 'Check for Updates Now'}
        </button>
        <small className="text-muted">
          Manually check for available updates
        </small>
        {updateStatus && (
          <div
            className={`status-message ${updateStatus.includes('failed') || updateStatus.includes('Error') ? 'error' : 'info'}`}
            style={{ marginTop: '8px' }}
          >
            {updateStatus}
          </div>
        )}
      </div>
    </div>
  );
};
