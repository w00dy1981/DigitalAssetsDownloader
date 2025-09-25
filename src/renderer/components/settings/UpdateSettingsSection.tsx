import React, { useState, useEffect, useCallback } from 'react';
import { UserSettings, IPC_CHANNELS } from '@/shared/types';
import { useStatusMessage } from '@/renderer/hooks';
import { appConstants } from '@/services/AppConstantsService';

interface UpdateSettingsSectionProps {
  settings: UserSettings;
  onSettingUpdate: (path: string, value: any) => void;
}

export const UpdateSettingsSection: React.FC<UpdateSettingsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateCheckTimeoutId, setUpdateCheckTimeoutId] =
    useState<NodeJS.Timeout | null>(null);
  const [updateStatus, showUpdateStatus] = useStatusMessage();

  const handleUpdateSettingChange = (settingKey: string, value: any) => {
    onSettingUpdate(`updateSettings.${settingKey}`, value);
  };

  // Set up update event listeners
  useEffect(() => {
    const handleUpdateChecking = () => {
      console.log('🔍 UI: Update check started');
      setIsCheckingForUpdates(true);
      showUpdateStatus('Checking for updates...');
    };

    const handleUpdateAvailable = (updateInfo: any) => {
      console.log('🎉 UI: Update available!', updateInfo);
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);
      showUpdateStatus(`Update available: v${updateInfo.version}`, appConstants.getUIConfiguration().statusMessageDuration);
    };

    const handleUpdateNotAvailable = () => {
      console.log('✅ UI: No updates available');
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);
      showUpdateStatus('You are running the latest version', 5000);
    };

    const handleUpdateError = (error: string) => {
      console.error('❌ UI: Update check failed:', error);
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);
      showUpdateStatus(`Update check failed: ${error}`, appConstants.getUIConfiguration().statusMessageDuration);
    };

    // Set up listeners with proper IPC channels
    window.electronAPI.onUpdateChecking?.(handleUpdateChecking);
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
    window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);
    window.electronAPI.onUpdateError?.(handleUpdateError);

    // Cleanup - remove all listeners for these channels when component unmounts  
    return () => {
      window.electronAPI.removeAllListeners?.(IPC_CHANNELS.UPDATE_CHECKING as any);
      window.electronAPI.removeAllListeners(IPC_CHANNELS.UPDATE_AVAILABLE as any);
      window.electronAPI.removeAllListeners(IPC_CHANNELS.UPDATE_NOT_AVAILABLE as any);
      window.electronAPI.removeAllListeners?.(IPC_CHANNELS.UPDATE_ERROR as any);

      // Clear any pending timeout
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
    };
  }, [updateCheckTimeoutId, showUpdateStatus]);

  // Manual update check with timeout mechanism and development mode detection
  const checkForUpdatesManually = useCallback(async () => {
    console.log('🔍 UI: Manual update check triggered by user');
    
    if (isCheckingForUpdates) {
      console.log('⚠️ UI: Update check already in progress, ignoring request');
      return; // Prevent multiple clicks
    }

    // Detect development mode (when running with npm run dev)
    const isDevelopment =
      process.env.NODE_ENV === 'development' ||
      !window.electronAPI;

    if (isDevelopment) {
      console.log('⚠️ UI: Development mode detected - update functionality may be limited');
    }

    try {
      console.log('⏱️ UI: Setting up update check timeout...');
      // Add shorter timeout for development mode
      const timeoutDuration = appConstants.getUpdateTimeout();
      const timeoutId = setTimeout(() => {
        console.warn(`⏰ UI: Update check timed out after ${timeoutDuration / 1000}s`);
        setIsCheckingForUpdates(false);
        setUpdateCheckTimeoutId(null);
        const message = isDevelopment
          ? 'Update checks may not work in development mode - try again in production build'
          : 'Update check timed out - try again later';
        showUpdateStatus(message, appConstants.getUIConfiguration().statusMessageDuration);
      }, timeoutDuration);
      setUpdateCheckTimeoutId(timeoutId);

      console.log('🚀 UI: Invoking window.electronAPI.checkForUpdates()...');
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      console.error('❌ UI: Manual update check failed:', error);
      // Clear timeout on error
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);

      const isDevelopment =
        process.env.NODE_ENV === 'development' ||
        !window.electronAPI;
      const message = isDevelopment
        ? 'Update checks are limited in development mode - build and test in production'
        : 'Update check failed - Please try again later';
      showUpdateStatus(message, appConstants.getUIConfiguration().statusMessageDuration);
    }
  }, [isCheckingForUpdates, updateCheckTimeoutId, showUpdateStatus]);

  return (
    <div className="config-section">
      <h3>Update Settings</h3>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.updateSettings.enableAutoUpdates}
            onChange={e =>
              handleUpdateSettingChange('enableAutoUpdates', e.target.checked)
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
              handleUpdateSettingChange(
                'checkForUpdatesOnStartup',
                e.target.checked
              )
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
        <label htmlFor="update-channel">Update channel</label>
        <select
          id="update-channel"
          value={settings.updateSettings.updateChannel}
          onChange={e =>
            handleUpdateSettingChange('updateChannel', e.target.value)
          }
          className="form-control"
          disabled={!settings.updateSettings.enableAutoUpdates}
        >
          <option value="stable">Stable (recommended)</option>
          <option value="beta">Beta (early access)</option>
        </select>
        <small className="text-muted">
          Stable releases are tested and recommended for production use
        </small>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.updateSettings.downloadUpdatesAutomatically}
            onChange={e =>
              handleUpdateSettingChange(
                'downloadUpdatesAutomatically',
                e.target.checked
              )
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
