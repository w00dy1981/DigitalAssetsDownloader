import React, { useState, useEffect } from 'react';
import type { DownloadOptions } from '@/download/downloadRun';
import type { LoadedInput } from '@/shared/types';
import InputSelectionTab from './components/InputSelectionTab';
import ColumnSelectionTab from './components/ColumnSelectionTab';
import ProcessTab from './components/ProcessTab';
import SettingsTab from './components/SettingsTab';
import { UpdateNotificationBanner } from './components/updater/UpdateNotificationBanner';
import { useUpdateNotification } from './components/updater/useUpdateNotification';

// Version injected by webpack at build time (KISS - single source of truth)
const APP_VERSION = process.env.APP_VERSION || 'development';

export interface WorkflowScreenProps {
  data: LoadedInput;
  onChange: (changes: Partial<DownloadOptions>) => void;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'input' | 'columns' | 'process' | 'settings'
  >('input');
  const [workflow, setWorkflow] = useState<
    (LoadedInput & { processEnabled: boolean }) | null
  >(null);
  const update = useUpdateNotification();

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

  function loadInput(data: LoadedInput) {
    setWorkflow(current =>
      current && current.loadId >= data.loadId
        ? current
        : { ...data, processEnabled: false }
    );
    setActiveTab('columns');
  }

  function updateOptions(changes: Partial<DownloadOptions>) {
    setWorkflow(current =>
      current && current.loadId === workflow?.loadId
        ? { ...current, options: { ...current.options, ...changes } }
        : current
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
          disabled={!workflow?.processEnabled}
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
          <InputSelectionTab onDataLoaded={loadInput} currentData={workflow} />
        </div>
        {activeTab === 'columns' && workflow && (
          <ColumnSelectionTab
            key={workflow.loadId}
            data={workflow}
            onChange={updateOptions}
            onNext={() => {
              setWorkflow({ ...workflow, processEnabled: true });
              setActiveTab('process');
            }}
          />
        )}
        {workflow?.processEnabled && (
          <div hidden={activeTab !== 'process'}>
            <ProcessTab
              key={workflow.loadId}
              data={workflow}
              onChange={updateOptions}
            />
          </div>
        )}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};

export default App;
