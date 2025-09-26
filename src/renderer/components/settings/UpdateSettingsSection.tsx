import React, { useState, useEffect, useCallback } from 'react';
import { UserSettings, IPC_CHANNELS } from '@/shared/types';
import { useStatusMessage } from '@/renderer/hooks';
import { appConstants } from '@/services/AppConstantsService';
import { ipcService } from '@/services/IPCService';
import { logger } from '@/services/LoggingService';

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
      logger.info('UpdateSettings: Update check started', 'UpdateSettings');
      setIsCheckingForUpdates(true);
      showUpdateStatus('Checking for updates...');
    };

    const handleUpdateAvailable = (updateInfo: any) => {
      logger.info(
        'UpdateSettings: Update available',
        'UpdateSettings',
        updateInfo
      );
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);
      showUpdateStatus(
        `Update available: v${updateInfo.version}`,
        appConstants.getUIConfiguration().statusMessageDuration
      );
    };

    const handleUpdateNotAvailable = () => {
      logger.info('UpdateSettings: No updates available', 'UpdateSettings');
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);
      showUpdateStatus('You are running the latest version', 5000);
    };

    const handleUpdateError = (error: string) => {
      logger.error(
        'UpdateSettings: Update check failed',
        new Error(error),
        'UpdateSettings'
      );
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);
      showUpdateStatus(
        `Update check failed: ${error}`,
        appConstants.getUIConfiguration().statusMessageDuration
      );
    };

    // Set up listeners with proper IPC channels
    ipcService.onUpdateChecking(handleUpdateChecking);
    ipcService.onUpdateAvailable(handleUpdateAvailable);
    ipcService.onUpdateNotAvailable(handleUpdateNotAvailable);
    ipcService.onUpdateError(handleUpdateError);

    // Cleanup - remove all listeners for these channels when component unmounts
    return () => {
      ipcService.cleanup([
        IPC_CHANNELS.UPDATE_CHECKING,
        IPC_CHANNELS.UPDATE_AVAILABLE,
        IPC_CHANNELS.UPDATE_NOT_AVAILABLE,
        IPC_CHANNELS.UPDATE_ERROR,
      ]);

      // Clear any pending timeout
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
    };
  }, [updateCheckTimeoutId, showUpdateStatus]);

  // Manual update check with timeout mechanism and development mode detection
  const checkForUpdatesManually = useCallback(async () => {
    logger.info(
      'UpdateSettings: Manual update check requested',
      'UpdateSettings'
    );

    if (isCheckingForUpdates) {
      logger.warn(
        'UpdateSettings: Update check already in progress - ignoring request',
        'UpdateSettings'
      );
      return; // Prevent multiple clicks
    }

    // Detect development mode (when running with npm run dev)
    const isDevelopment =
      process.env.NODE_ENV === 'development' ||
      !ipcService.isElectronAvailable();

    if (isDevelopment) {
      logger.warn(
        'UpdateSettings: Development mode detected - update functionality may be limited',
        'UpdateSettings'
      );
    }

    try {
      // Add shorter timeout for development mode
      const timeoutDuration = appConstants.getUpdateTimeout();
      const timeoutId = setTimeout(() => {
        logger.warn(
          `UpdateSettings: Update check timed out after ${timeoutDuration / 1000}s`,
          'UpdateSettings'
        );
        setIsCheckingForUpdates(false);
        setUpdateCheckTimeoutId(null);
        const message = isDevelopment
          ? 'Update checks may not work in development mode - try again in production build'
          : 'Update check timed out - try again later';
        showUpdateStatus(
          message,
          appConstants.getUIConfiguration().statusMessageDuration
        );
      }, timeoutDuration);
      setUpdateCheckTimeoutId(timeoutId);

      await ipcService.checkForUpdates();
    } catch (error) {
      logger.error(
        'UpdateSettings: Manual update check failed',
        error instanceof Error ? error : new Error(String(error)),
        'UpdateSettings'
      );
      // Clear timeout on error
      if (updateCheckTimeoutId) {
        clearTimeout(updateCheckTimeoutId);
        setUpdateCheckTimeoutId(null);
      }
      setIsCheckingForUpdates(false);

      const isDevelopment =
        process.env.NODE_ENV === 'development' ||
        !ipcService.isElectronAvailable();
      const message = isDevelopment
        ? 'Update checks are limited in development mode - build and test in production'
        : 'Update check failed - Please try again later';
      showUpdateStatus(
        message,
        appConstants.getUIConfiguration().statusMessageDuration
      );
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
