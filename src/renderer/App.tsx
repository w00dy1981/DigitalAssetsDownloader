import React, { useState, useCallback } from 'react';
import type { UpdateInfo } from 'electron-updater';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import FileSelectionTab from './components/FileSelectionTab';
import ColumnSelectionTab from './components/ColumnSelectionTab';
import ProcessTab from './components/ProcessTab';
import SettingsTab from './components/SettingsTab';
import { useEventListeners } from './hooks/useEventListeners';
import { configurationService } from '@/services/ConfigurationService';
import { logger } from '@/services/LoggingService';
import { ipcService } from '@/services/IPCService';
import { useStatusMessage } from './hooks/useStatusMessage';
import './App.css';

// Version injected by webpack at build time (KISS - single source of truth)
const APP_VERSION = process.env.APP_VERSION || 'development';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [spreadsheetData, setSpreadsheetData] =
    useState<SpreadsheetData | null>(null);
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig | null>(
    null
  );
  // Simple update notification state - Issue #14
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingForUpdate, setIsCheckingForUpdate] =
    useState<boolean>(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] =
    useState<boolean>(false);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState<
    number | null
  >(null);
  const [isUpdateDownloaded, setIsUpdateDownloaded] = useState<boolean>(false);
  const [statusMessage, showStatusMessage] = useStatusMessage();

  const clearUpdateNotification = useCallback(() => {
    setHasUpdateAvailable(false);
    setUpdateInfo(null);
    setUpdateStatus(null);
    setIsCheckingForUpdate(false);
    setIsDownloadingUpdate(false);
    setUpdateDownloadProgress(null);
    setIsUpdateDownloaded(false);
  }, []);

  // Event listeners using custom hook
  useEventListeners([
    {
      channel: 'menu-open-file',
      handler: () => setActiveTab(0),
      dependencies: [],
    },
    {
      channel: 'menu-save-config',
      handler: () => {
        if (downloadConfig) {
          saveConfiguration();
        }
      },
      dependencies: [downloadConfig],
    },
    {
      channel: 'menu-open-settings',
      handler: () => setActiveTab(3),
      dependencies: [],
    },
    {
      channel: 'update-checking',
      handler: () => {
        setIsCheckingForUpdate(true);
        setUpdateStatus('Checking for updates...');
        setIsDownloadingUpdate(false);
        setUpdateDownloadProgress(null);
      },
      dependencies: [],
    },
    {
      channel: 'update-available',
      handler: info => {
        setHasUpdateAvailable(true);
        setUpdateInfo((info as UpdateInfo) ?? null);
        setIsCheckingForUpdate(false);
        setIsDownloadingUpdate(false);
        setUpdateDownloadProgress(null);
        setIsUpdateDownloaded(false);
        setUpdateStatus('Update available. Ready to download.');
      },
      dependencies: [],
    },
    {
      channel: 'update-not-available',
      handler: () => {
        clearUpdateNotification();
        setUpdateStatus('You are running the latest version.');
      },
      dependencies: [clearUpdateNotification],
    },
    {
      channel: 'update-download-progress',
      handler: progress => {
        const percent =
          typeof (progress as { percent?: number }).percent === 'number'
            ? ((progress as { percent?: number }).percent as number)
            : 0;
        setIsDownloadingUpdate(true);
        setIsCheckingForUpdate(false);
        setUpdateDownloadProgress(percent);
        setUpdateStatus(`Downloading update... ${Math.round(percent)}%`);
      },
      dependencies: [],
    },
    {
      channel: 'update-downloaded',
      handler: info => {
        setIsDownloadingUpdate(false);
        setIsCheckingForUpdate(false);
        setUpdateDownloadProgress(100);
        setIsUpdateDownloaded(true);
        if (info) {
          setUpdateInfo((info as UpdateInfo) ?? null);
        }
        setHasUpdateAvailable(true);
        setUpdateStatus('Update downloaded. Ready to install.');
      },
      dependencies: [],
    },
    {
      channel: 'update-error',
      handler: errorMessage => {
        const message =
          typeof errorMessage === 'string'
            ? errorMessage
            : 'An unexpected error occurred during update.';
        setUpdateStatus(`Update error: ${message}`);
        setIsCheckingForUpdate(false);
        setIsDownloadingUpdate(false);
        setUpdateDownloadProgress(null);
        logger.error('App: Auto-update error', new Error(message), 'App');
      },
      dependencies: [],
    },
  ]);

  const saveConfiguration = async () => {
    if (!downloadConfig) return;

    try {
      const result =
        await configurationService.saveDownloadConfig(downloadConfig);
      if (result.success) {
        showStatusMessage(result.message, 3000);
        logger.info('App: Configuration saved successfully', 'App');
      } else {
        showStatusMessage(result.message, 3000);
        logger.error(
          'App: Error saving configuration',
          new Error(result.message),
          'App'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save configuration.';
      showStatusMessage(message, 3000);
      logger.error(
        'App: Unexpected error saving configuration',
        error instanceof Error ? error : new Error(message),
        'App'
      );
    }
  };

  const handleDataLoaded = (data: SpreadsheetData) => {
    setSpreadsheetData(data);
    setActiveTab(1); // Move to column selection tab
  };

  const handleConfigurationComplete = (config: DownloadConfig) => {
    setDownloadConfig(config);
    setActiveTab(2); // Move to process tab
  };

  const handleTabChange = (tabIndex: number) => {
    // Validate before allowing tab change (Settings tab is always accessible)
    if (tabIndex === 1 && !spreadsheetData) {
      showStatusMessage('Please load an Excel file first.', 3000);
      return;
    }
    if (tabIndex === 2 && !downloadConfig) {
      showStatusMessage('Please complete column selection first.', 3000);
      return;
    }
    // Settings tab (index 3) is always accessible
    setActiveTab(tabIndex);
  };

  const handleDownloadUpdate = useCallback(async () => {
    try {
      setUpdateStatus('Starting update download...');
      setIsCheckingForUpdate(false);
      setIsDownloadingUpdate(true);
      await ipcService.downloadUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateStatus(`Download failed: ${message}`);
      setIsDownloadingUpdate(false);
      logger.error(
        'App: Update download failed',
        error instanceof Error ? error : new Error(message),
        'App'
      );
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    try {
      setUpdateStatus('Installing update...');
      await ipcService.installUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateStatus(`Install failed: ${message}`);
      logger.error(
        'App: Update install failed',
        error instanceof Error ? error : new Error(message),
        'App'
      );
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Digital Asset Downloader</h1>
        <div className="version-info">
          v{APP_VERSION}
          {hasUpdateAvailable && (
            <span className="update-badge">Update Available</span>
          )}
        </div>
      </header>

      {statusMessage && (
        <div
          className={`app-status ${
            statusMessage.toLowerCase().includes('error') ||
            statusMessage.toLowerCase().includes('fail')
              ? 'error'
              : 'info'
          }`}
        >
          {statusMessage}
        </div>
      )}

      <nav className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 0 ? 'active' : ''}`}
          onClick={() => handleTabChange(0)}
        >
          1. File Selection
        </button>
        <button
          className={`tab-button ${activeTab === 1 ? 'active' : ''}`}
          onClick={() => handleTabChange(1)}
          disabled={!spreadsheetData}
        >
          2. Column Selection
        </button>
        <button
          className={`tab-button ${activeTab === 2 ? 'active' : ''}`}
          onClick={() => handleTabChange(2)}
          disabled={!downloadConfig}
        >
          3. Process & Download
        </button>
        <button
          className={`tab-button ${activeTab === 3 ? 'active' : ''}`}
          onClick={() => handleTabChange(3)}
        >
          4. Settings
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 0 && (
          <FileSelectionTab
            onDataLoaded={handleDataLoaded}
            currentData={spreadsheetData}
            hasUpdateAvailable={hasUpdateAvailable}
            updateInfo={updateInfo}
            updateStatus={updateStatus}
            isCheckingForUpdate={isCheckingForUpdate}
            isDownloadingUpdate={isDownloadingUpdate}
            updateDownloadProgress={updateDownloadProgress}
            isUpdateDownloaded={isUpdateDownloaded}
            onDownloadUpdate={handleDownloadUpdate}
            onInstallUpdate={handleInstallUpdate}
            onUpdateHandled={clearUpdateNotification}
          />
        )}
        {activeTab === 1 && spreadsheetData && (
          <ColumnSelectionTab
            data={spreadsheetData}
            onConfigurationComplete={handleConfigurationComplete}
            initialConfig={downloadConfig}
          />
        )}
        {activeTab === 2 && downloadConfig && (
          <ProcessTab
            config={downloadConfig}
            onConfigurationChange={setDownloadConfig}
          />
        )}
        {activeTab === 3 && <SettingsTab />}
      </main>
    </div>
  );
};

export default App;
