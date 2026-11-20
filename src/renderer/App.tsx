import React, { useState, useEffect } from 'react';
import type { LoadedInput, DownloadConfig } from '@/shared/types';
import InputSelectionTab from './components/InputSelectionTab';
import ColumnSelectionTab from './components/ColumnSelectionTab';
import ProcessTab from './components/ProcessTab';
import SettingsTab from './components/SettingsTab';
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
    data: LoadedInput;
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
        console.error('App: Error saving configuration', new Error(message));
      }
    });
  }, [downloadConfig, showStatusMessage]);

  function loadInput(data: LoadedInput) {
    setWorkflow(current =>
      current && current.data.loadId >= data.loadId
        ? current
        : { data, config: null }
    );
    setActiveTab('columns');
  }

  function updateConfig(loadId: LoadedInput['loadId'], config: DownloadConfig) {
    setWorkflow(current =>
      current?.data.loadId === loadId ? { ...current, config } : current
    );
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
            key={workflow.data.loadId}
            data={workflow.data}
            initialConfig={workflow.config}
            onConfigurationComplete={config => {
              updateConfig(workflow.data.loadId, config);
              setActiveTab('process');
            }}
          />
        )}
        {workflow && downloadConfig && (
          <div hidden={activeTab !== 'process'}>
            <ProcessTab
              key={workflow.data.loadId}
              config={downloadConfig}
              loadId={workflow.data.loadId}
              onConfigurationChange={config =>
                updateConfig(workflow.data.loadId, config)
              }
            />
          </div>
        )}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};

export default App;
