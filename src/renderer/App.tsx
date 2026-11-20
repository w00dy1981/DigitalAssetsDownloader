import React, { useState, useEffect } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import InputSelectionTab from './components/InputSelectionTab';
import ColumnSelectionTab from './components/ColumnSelectionTab';
import ProcessTab from './components/ProcessTab';
import SettingsTab from './components/SettingsTab';
import { logger } from '@/services/LoggingService';
import { useStatusMessage } from './hooks/useStatusMessage';
import { UpdateNotificationBanner } from './components/updater/UpdateNotificationBanner';
import { useUpdateNotification } from './components/updater/useUpdateNotification';
import './App.css';

// Version injected by webpack at build time (KISS - single source of truth)
const APP_VERSION = process.env.APP_VERSION || 'development';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'input' | 'columns' | 'process' | 'settings'
  >('input');
  const [workflow, setWorkflow] = useState<{
    data: SpreadsheetData;
    config: DownloadConfig | null;
  } | null>(null);
  const downloadConfig = workflow?.config;
  const update = useUpdateNotification();
  const [statusMessage, showStatusMessage] = useStatusMessage();

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const offOpen = api.onMenuOpenFile(() => setActiveTab('input'));
    const offSettings = api.onMenuOpenSettings(() => setActiveTab('settings'));
    return () => {
      offOpen();
      offSettings();
    };
  }, []);

  useEffect(() => {
    if (!downloadConfig) return;

    return window.electronAPI?.onMenuSaveConfig(async () => {
      try {
        await window.electronAPI.saveConfig(downloadConfig);
        showStatusMessage('Configuration saved successfully', 3000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showStatusMessage(`Error saving configuration: ${message}`, 3000);
        logger.error(
          'App: Error saving configuration',
          new Error(message),
          'App'
        );
      }
    });
  }, [downloadConfig, showStatusMessage]);

  function loadInput(data: SpreadsheetData) {
    setWorkflow({ data, config: null });
    setActiveTab('columns');
  }

  function updateConfig(config: DownloadConfig) {
    setWorkflow(current => current && { ...current, config });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Digital Asset Downloader</h1>
        <div className="version-info">
          v{APP_VERSION}
          {update.notice && (
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
          className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          1. Input Selection
        </button>
        <button
          className={`tab-button ${activeTab === 'columns' ? 'active' : ''}`}
          onClick={() => setActiveTab('columns')}
          disabled={!workflow}
        >
          2. Column Selection
        </button>
        <button
          className={`tab-button ${activeTab === 'process' ? 'active' : ''}`}
          onClick={() => setActiveTab('process')}
          disabled={!downloadConfig}
        >
          3. Process & Download
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          4. Settings
        </button>
      </nav>

      <main className="tab-content">
        <div hidden={activeTab !== 'input'}>
          {update.notice && (
            <UpdateNotificationBanner
              currentVersion={APP_VERSION}
              notice={update.notice}
              onDownload={update.download}
              onInstall={update.install}
              onDismiss={update.dismiss}
            />
          )}
          <InputSelectionTab
            onDataLoaded={loadInput}
            currentData={workflow?.data ?? null}
          />
        </div>
        {activeTab === 'columns' && workflow && (
          <ColumnSelectionTab
            data={workflow.data}
            initialConfig={workflow.config}
            onConfigurationComplete={config => {
              updateConfig(config);
              setActiveTab('process');
            }}
          />
        )}
        {downloadConfig && (
          <div hidden={activeTab !== 'process'}>
            <ProcessTab
              config={downloadConfig}
              onConfigurationChange={updateConfig}
            />
          </div>
        )}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};

export default App;
