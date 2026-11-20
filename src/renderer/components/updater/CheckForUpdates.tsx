import { useState } from 'react';
import { useStatusMessage } from '@/renderer/hooks/useStatusMessage';
import { UI_CONSTANTS } from '@/shared/constants';
import { logger } from '@/services/LoggingService';

export function CheckForUpdates() {
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateStatus, showUpdateStatus] = useStatusMessage();

  async function checkForUpdatesManually() {
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
  }

  return (
    <div className="form-group">
      <button
        className={`btn btn-primary ${isCheckingForUpdates ? 'loading' : ''}`}
        onClick={checkForUpdatesManually}
        disabled={isCheckingForUpdates}
        style={{ marginRight: '10px' }}
      >
        {isCheckingForUpdates ? 'Checking...' : 'Check for Updates Now'}
      </button>
      <small className="text-muted">Manually check for available updates</small>
      {updateStatus && (
        <div
          className={`status-message ${updateStatus.includes('failed') || updateStatus.includes('Error') ? 'error' : 'info'}`}
          style={{ marginTop: '8px' }}
        >
          {updateStatus}
        </div>
      )}
    </div>
  );
}
