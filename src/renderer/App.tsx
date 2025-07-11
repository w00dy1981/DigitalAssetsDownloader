import React, { useState, useEffect } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import FileSelectionTab from './components/FileSelectionTab';
import ColumnSelectionTab from './components/ColumnSelectionTab';
import ProcessTab from './components/ProcessTab';
import SettingsTab from './components/SettingsTab';
import './App.css';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig | null>(null);

  useEffect(() => {
    // Listen for menu events
    const handleMenuOpenFile = () => {
      setActiveTab(0); // Switch to file selection tab
    };

    const handleMenuSaveConfig = () => {
      if (downloadConfig) {
        saveConfiguration();
      }
    };

    window.electronAPI.onMenuOpenFile(handleMenuOpenFile);
    window.electronAPI.onMenuSaveConfig(handleMenuSaveConfig);

    return () => {
      window.electronAPI.removeAllListeners('menu-open-file' as any);
      window.electronAPI.removeAllListeners('menu-save-config' as any);
    };
  }, [downloadConfig]);

  const saveConfiguration = async () => {
    if (!downloadConfig) return;
    
    try {
      await window.electronAPI.saveConfig(downloadConfig);
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration.');
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
      alert('Please load an Excel file first.');
      return;
    }
    if (tabIndex === 2 && !downloadConfig) {
      alert('Please complete column selection first.');
      return;
    }
    // Settings tab (index 3) is always accessible
    setActiveTab(tabIndex);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Digital Asset Downloader</h1>
      </header>
      
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
        {activeTab === 3 && (
          <SettingsTab />
        )}
      </main>
    </div>
  );
};

export default App;
