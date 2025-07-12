import React, { useState, useEffect, useCallback } from 'react';
import { UserSettings } from '@/shared/types';

interface SettingsTabProps {
  onSettingsChange?: (settings: UserSettings) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ onSettingsChange }) => {
  // Default settings values
  const defaultSettings: UserSettings = {
    defaultPaths: {
      lastFileDialogPath: '',
      imageDownloadFolder: '',
      pdfDownloadFolder: '',
      sourceImageFolder: '',
      imageNetworkPath: '',
      pdfNetworkPath: '',
    },
    downloadBehavior: {
      defaultConcurrentDownloads: 5,
      connectionTimeout: 5,
      readTimeout: 30,
      retryAttempts: 3,
    },
    imageProcessing: {
      enabledByDefault: true,
      defaultMethod: 'smart_detect',
      defaultQuality: 95,
      defaultEdgeThreshold: 30,
    },
    uiPreferences: {
      rememberFileDialogPath: true,
      showAdvancedOptions: false,
      startupTab: 'file',
    },
    updateSettings: {
      enableAutoUpdates: true,
      checkForUpdatesOnStartup: true,
      updateChannel: 'stable',
      downloadUpdatesAutomatically: false,
    },
  };

  // State for all settings
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await window.electronAPI.loadSettings();
        if (savedSettings) {
          // Merge with defaults to ensure all properties exist
          const mergedSettings = {
            ...defaultSettings,
            ...savedSettings,
            defaultPaths: {
              ...defaultSettings.defaultPaths,
              ...savedSettings.defaultPaths,
            },
            downloadBehavior: {
              ...defaultSettings.downloadBehavior,
              ...savedSettings.downloadBehavior,
            },
            imageProcessing: {
              ...defaultSettings.imageProcessing,
              ...savedSettings.imageProcessing,
            },
            uiPreferences: {
              ...defaultSettings.uiPreferences,
              ...savedSettings.uiPreferences,
            },
            updateSettings: {
              ...defaultSettings.updateSettings,
              ...savedSettings.updateSettings,
            },
          };
          setSettings(mergedSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings function
  const saveSettings = useCallback(async () => {
    try {
      await window.electronAPI.saveSettings(settings);
      setSaveStatus('Settings saved successfully');
      setHasChanges(false);
      onSettingsChange?.(settings);
      
      // Clear status after 2 seconds
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('Error saving settings');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [settings, onSettingsChange]);

  // Auto-save with debounce
  useEffect(() => {
    if (hasChanges) {
      const timeoutId = setTimeout(() => {
        saveSettings();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [settings, hasChanges, saveSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(true);
  }, []);

  // Browse for folder
  const browseForFolder = useCallback(async (settingPath: string) => {
    try {
      const result = await window.electronAPI.openFolderDialog({
        title: 'Select Folder',
        properties: ['openDirectory'],
      });
      
      if (result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        
        // Update the appropriate setting
        setSettings(prev => {
          const newSettings = { ...prev };
          const pathParts = settingPath.split('.');
          
          if (pathParts.length === 2 && pathParts[0] === 'defaultPaths') {
            newSettings.defaultPaths = {
              ...newSettings.defaultPaths,
              [pathParts[1]]: selectedPath,
            };
          }
          
          return newSettings;
        });
        setHasChanges(true);
      }
    } catch (error) {
      console.error('Error browsing for folder:', error);
    }
  }, []);

  // Update setting helper
  const updateSetting = useCallback((path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const pathParts = path.split('.');
      
      if (pathParts.length === 2) {
        const [section, key] = pathParts;
        if (section in newSettings) {
          (newSettings as any)[section] = {
            ...(newSettings as any)[section],
            [key]: value,
          };
        }
      }
      
      return newSettings;
    });
    setHasChanges(true);
  }, []);

  // State for update checking
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);

  // Set up update event listeners
  useEffect(() => {
    const handleUpdateAvailable = (updateInfo: any) => {
      setIsCheckingForUpdates(false);
      setSaveStatus(`Update available: v${updateInfo.version}`);
      setTimeout(() => setSaveStatus(''), 8000);
    };

    const handleUpdateNotAvailable = () => {
      setIsCheckingForUpdates(false);
      setSaveStatus('You are running the latest version');
      setTimeout(() => setSaveStatus(''), 5000);
    };

    // Set up listeners
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
    window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);

    // Cleanup
    return () => {
      window.electronAPI.removeAllListeners('update-available');
      window.electronAPI.removeAllListeners('update-not-available');
    };
  }, []);

  // Manual update check
  const checkForUpdatesManually = useCallback(async () => {
    if (isCheckingForUpdates) return; // Prevent multiple clicks
    
    try {
      setIsCheckingForUpdates(true);
      setSaveStatus('Checking for updates...');
      await window.electronAPI.checkForUpdates();
      // Don't set status here - let the event listeners handle it
    } catch (error) {
      console.error('Manual update check failed:', error);
      setIsCheckingForUpdates(false);
      setSaveStatus('Update check failed - Please try again later');
      setTimeout(() => setSaveStatus(''), 5000);
    }
  }, [isCheckingForUpdates]);

  return (
    <div className="tab-content settings-tab">
      <div className="tab-header">
        <h2>Settings</h2>
        <div className="tab-actions">
          {saveStatus && (
            <span className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
              {saveStatus}
            </span>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={resetToDefaults}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
      
      <div className="configuration-sections">
        {/* Default Paths Section - Takes first column */}
        <div className="config-section default-paths">
          <h3>Default Paths</h3>
          
          <div className="form-group">
            <label htmlFor="image-download-folder">Image Download Folder</label>
            <div className="folder-input-group">
              <input
                id="image-download-folder"
                type="text"
                value={settings.defaultPaths.imageDownloadFolder}
                onChange={(e) => updateSetting('defaultPaths.imageDownloadFolder', e.target.value)}
                className="form-control"
                placeholder="Choose folder for downloading images..."
              />
              <button
                className="btn btn-secondary browse-btn"
                onClick={() => browseForFolder('defaultPaths.imageDownloadFolder')}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="pdf-download-folder">PDF Download Folder</label>
            <div className="folder-input-group">
              <input
                id="pdf-download-folder"
                type="text"
                value={settings.defaultPaths.pdfDownloadFolder}
                onChange={(e) => updateSetting('defaultPaths.pdfDownloadFolder', e.target.value)}
                className="form-control"
                placeholder="Choose folder for downloading PDFs..."
              />
              <button
                className="btn btn-secondary browse-btn"
                onClick={() => browseForFolder('defaultPaths.pdfDownloadFolder')}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="source-image-folder">Source Image Folder</label>
            <div className="folder-input-group">
              <input
                id="source-image-folder"
                type="text"
                value={settings.defaultPaths.sourceImageFolder}
                onChange={(e) => updateSetting('defaultPaths.sourceImageFolder', e.target.value)}
                className="form-control"
                placeholder="Choose folder to search for existing images..."
              />
              <button
                className="btn btn-secondary browse-btn"
                onClick={() => browseForFolder('defaultPaths.sourceImageFolder')}
              >
                Browse
              </button>
            </div>
            <small className="text-muted">
              Optional: Folder to search for existing images by part number
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="image-network-path">Image Network Path (for CSV logging)</label>
            <div className="folder-input-group">
              <input
                id="image-network-path"
                type="text"
                value={settings.defaultPaths.imageNetworkPath}
                onChange={(e) => updateSetting('defaultPaths.imageNetworkPath', e.target.value)}
                className="form-control"
                placeholder="Network path for image file logging..."
              />
              <button
                className="btn btn-secondary browse-btn"
                onClick={() => browseForFolder('defaultPaths.imageNetworkPath')}
              >
                Browse
              </button>
            </div>
            <small className="text-muted">
              Network path used for CSV logging (separate from download location)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="pdf-network-path">PDF Network Path (for CSV logging)</label>
            <div className="folder-input-group">
              <input
                id="pdf-network-path"
                type="text"
                value={settings.defaultPaths.pdfNetworkPath}
                onChange={(e) => updateSetting('defaultPaths.pdfNetworkPath', e.target.value)}
                className="form-control"
                placeholder="Network path for PDF file logging..."
              />
              <button
                className="btn btn-secondary browse-btn"
                onClick={() => browseForFolder('defaultPaths.pdfNetworkPath')}
              >
                Browse
              </button>
            </div>
            <small className="text-muted">
              Network path used for PDF CSV logging (separate from download location)
            </small>
          </div>

          {/* UI Preferences Section */}
          <div className="config-section">
            <h3>UI Preferences</h3>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.uiPreferences.rememberFileDialogPath}
                  onChange={(e) => updateSetting('uiPreferences.rememberFileDialogPath', e.target.checked)}
                />
                Remember file dialog location
              </label>
              <small className="text-muted">
                File dialogs will open to the last used location
              </small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.uiPreferences.showAdvancedOptions}
                  onChange={(e) => updateSetting('uiPreferences.showAdvancedOptions', e.target.checked)}
                />
                Show advanced options
              </label>
              <small className="text-muted">
                Display advanced configuration options in other tabs
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="startup-tab">Default startup tab</label>
              <select
                id="startup-tab"
                value={settings.uiPreferences.startupTab}
                onChange={(e) => updateSetting('uiPreferences.startupTab', e.target.value)}
                className="form-control"
              >
                <option value="file">File Selection</option>
                <option value="column">Column Selection</option>
                <option value="process">Process & Download</option>
                <option value="settings">Settings</option>
              </select>
            </div>
          </div>

          {/* Update Settings Section */}
          <div className="config-section">
            <h3>Update Settings</h3>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.updateSettings.enableAutoUpdates}
                  onChange={(e) => updateSetting('updateSettings.enableAutoUpdates', e.target.checked)}
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
                  onChange={(e) => updateSetting('updateSettings.checkForUpdatesOnStartup', e.target.checked)}
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
                onChange={(e) => updateSetting('updateSettings.updateChannel', e.target.value)}
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
                  onChange={(e) => updateSetting('updateSettings.downloadUpdatesAutomatically', e.target.checked)}
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
            </div>
          </div>
        </div>

        {/* Second column - stacked sections */}
        <div className="other-settings">
          {/* Download Behavior Section */}
          <div className="config-section">
            <h3>Download Behavior</h3>
            
            <div className="form-group">
              <label htmlFor="concurrent-downloads">Concurrent Downloads</label>
              <div className="number-input-group">
                <input
                  id="concurrent-downloads"
                  type="number"
                  min="1"
                  max="20"
                  value={settings.downloadBehavior.defaultConcurrentDownloads}
                  onChange={(e) => updateSetting('downloadBehavior.defaultConcurrentDownloads', parseInt(e.target.value))}
                  className="form-control number-input"
                />
                <span className="input-suffix">workers</span>
              </div>
              <small className="text-muted">
                Number of simultaneous downloads (1-20)
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="connection-timeout">Connection Timeout</label>
              <div className="number-input-group">
                <input
                  id="connection-timeout"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.downloadBehavior.connectionTimeout}
                  onChange={(e) => updateSetting('downloadBehavior.connectionTimeout', parseInt(e.target.value))}
                  className="form-control number-input"
                />
                <span className="input-suffix">seconds</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="read-timeout">Read Timeout</label>
              <div className="number-input-group">
                <input
                  id="read-timeout"
                  type="number"
                  min="10"
                  max="300"
                  value={settings.downloadBehavior.readTimeout}
                  onChange={(e) => updateSetting('downloadBehavior.readTimeout', parseInt(e.target.value))}
                  className="form-control number-input"
                />
                <span className="input-suffix">seconds</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="retry-attempts">Retry Attempts</label>
              <div className="number-input-group">
                <input
                  id="retry-attempts"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.downloadBehavior.retryAttempts}
                  onChange={(e) => updateSetting('downloadBehavior.retryAttempts', parseInt(e.target.value))}
                  className="form-control number-input"
                />
                <span className="input-suffix">attempts</span>
              </div>
            </div>
          </div>

          {/* Image Processing Section */}
          <div className="config-section">
            <h3>Image Processing</h3>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.imageProcessing.enabledByDefault}
                  onChange={(e) => updateSetting('imageProcessing.enabledByDefault', e.target.checked)}
                />
                Enable background processing by default
              </label>
              <small className="text-muted">
                Automatically enable background processing for new configurations
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="processing-method">Default Processing Method</label>
              <select
                id="processing-method"
                value={settings.imageProcessing.defaultMethod}
                onChange={(e) => updateSetting('imageProcessing.defaultMethod', e.target.value)}
                className="form-control"
              >
                <option value="smart_detect">Smart Detection</option>
                <option value="ai_removal">AI Removal</option>
                <option value="color_replace">Color Replacement</option>
                <option value="edge_detection">Edge Detection</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="jpeg-quality">JPEG Quality</label>
              <div className="number-input-group">
                <input
                  id="jpeg-quality"
                  type="number"
                  min="60"
                  max="100"
                  value={settings.imageProcessing.defaultQuality}
                  onChange={(e) => updateSetting('imageProcessing.defaultQuality', parseInt(e.target.value))}
                  className="form-control number-input"
                />
                <span className="input-suffix">%</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="edge-threshold">Edge Detection Threshold</label>
              <div className="number-input-group">
                <input
                  id="edge-threshold"
                  type="number"
                  min="10"
                  max="100"
                  value={settings.imageProcessing.defaultEdgeThreshold}
                  onChange={(e) => updateSetting('imageProcessing.defaultEdgeThreshold', parseInt(e.target.value))}
                  className="form-control number-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;