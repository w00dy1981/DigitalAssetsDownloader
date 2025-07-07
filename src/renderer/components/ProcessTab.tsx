import React, { useState, useEffect, useCallback } from 'react';
import { DownloadConfig, DownloadProgress } from '@/shared/types';

interface ProcessTabProps {
  config: DownloadConfig;
  onConfigurationChange: (config: DownloadConfig) => void;
}

const ProcessTab: React.FC<ProcessTabProps> = ({ config, onConfigurationChange }) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<DownloadProgress>({
    currentFile: '',
    successful: 0,
    failed: 0,
    total: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const handleProgress = (data: DownloadProgress) => {
      console.log('Progress update received:', data); // Debug log
      setProgress(data);
    };

    const handleComplete = (data: any) => {
      console.log('Download complete:', data); // Debug log
      setIsDownloading(false);
      
      if (data.error) {
        setLogs(prev => [...prev, `Download error: ${data.error}`]);
      } else if (data.cancelled) {
        setLogs(prev => [...prev, `Downloads cancelled: ${data.successful || 0} successful, ${data.failed || 0} failed`]);
      } else {
        setLogs(prev => [...prev, 
          `Downloads complete: ${data.successful || 0} successful, ${data.failed || 0} failed`,
          data.logFile ? `Log file saved: ${data.logFile}` : ''
        ].filter(Boolean));
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);
    window.electronAPI.onDownloadComplete(handleComplete);

    return () => {
      window.electronAPI.removeAllListeners('download-progress' as any);
      window.electronAPI.removeAllListeners('download-complete' as any);
    };
  }, []);

  const handleStartDownloads = useCallback(async () => {
    if (isDownloading) return;

    // Validate configuration
    if (!config.partNoColumn) {
      setLogs(prev => [...prev, 'Error: Please select a Part Number column']);
      return;
    }

    if (!config.imageColumns.length && !config.pdfColumn) {
      setLogs(prev => [...prev, 'Error: Please select at least one Image URL column or PDF column']);
      return;
    }

    if (!config.imageFolder && !config.pdfFolder) {
      setLogs(prev => [...prev, 'Error: Please select download folders']);
      return;
    }

    setIsDownloading(true);
    setStartTime(Date.now());
    setProgress({
      currentFile: '',
      successful: 0,
      failed: 0,
      total: 0,
      percentage: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0
    });
    setLogs(['Starting downloads...']);

    try {
      const result = await window.electronAPI.startDownloads(config);
      if (result.success) {
        setLogs(prev => [...prev, result.message]);
      } else {
        setLogs(prev => [...prev, `Error: ${result.message || 'Unknown error'}`]);
        setIsDownloading(false);
      }
    } catch (error) {
      console.error('Error starting downloads:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLogs(prev => [...prev, `Error starting downloads: ${errorMessage}`]);
      setIsDownloading(false);
    }
  }, [config, isDownloading]);

  const handleCancelDownloads = useCallback(async () => {
    if (!isDownloading) return;

    try {
      await window.electronAPI.cancelDownloads();
      setIsDownloading(false);
      setLogs(prev => [...prev, 'Downloads cancelled by user']);
    } catch (error) {
      console.error('Error cancelling downloads:', error);
    }
  }, [isDownloading]);

  const handleFolderSelect = useCallback(async (setter: (value: string) => void, currentValue: string) => {
    try {
      const result = await window.electronAPI.openFolderDialog({
        title: 'Select Folder',
        defaultPath: currentValue
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        setter(result.filePaths[0]);
      }
    } catch (err) {
      console.error('Error opening folder dialog:', err);
    }
  }, []);

  const updateConfig = useCallback((updates: Partial<DownloadConfig>) => {
    onConfigurationChange({ ...config, ...updates });
  }, [config, onConfigurationChange]);

  // Initialize default ERP paths when component mounts (only if empty)
  useEffect(() => {
    // Set default paths only if they are empty/undefined
    const updates: Partial<DownloadConfig> = {};
    
    if (!config.imageFilePath || config.imageFilePath.trim() === '') {
      updates.imageFilePath = "U:\\old_g\\IMAGES\\ABM Product Images";
    }
    
    if (!config.pdfFilePath || config.pdfFilePath.trim() === '') {
      updates.pdfFilePath = "U:\\old_g\\IMAGES\\Product pdf\\'s";
    }
    
    // Only update if there are changes to avoid infinite re-renders
    if (Object.keys(updates).length > 0) {
      updateConfig(updates);
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    
    if (!config.partNoColumn) {
      errors.push('Part Number column is required');
    }
    
    if (!config.imageColumns.length && !config.pdfColumn) {
      errors.push('At least one Image URL column or PDF column is required');
    }
    
    if (config.imageColumns.length > 0 && !config.imageFolder) {
      errors.push('Image download folder is required when image columns are selected');
    }
    
    if (config.pdfColumn && !config.pdfFolder) {
      errors.push('PDF download folder is required when PDF column is selected');
    }
    
    return errors;
  };

  const validationErrors = getValidationErrors();
  const isConfigValid = validationErrors.length === 0;

  const getProgressBarClass = (): string => {
    if (progress.total === 0) return '';
    
    const successRate = progress.successful / progress.total;
    if (successRate >= 0.9) return 'success';
    if (successRate >= 0.7) return 'warning';
    return 'danger';
  };

  return (
    <div className="tab-panel">
      <h2>Process & Download</h2>
      <p>Review your configuration and start the download process.</p>
      
      {/* Configuration Summary */}
      <div className="config-summary">
        <h3>Configuration Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <strong>Excel File:</strong> {config.excelFile}
          </div>
          <div className="summary-item">
            <strong>Sheet:</strong> {config.sheetName}
          </div>
          <div className="summary-item">
            <strong>Part Number Column:</strong> {config.partNoColumn}
          </div>
          <div className="summary-item">
            <strong>Image Columns:</strong> {config.imageColumns.join(', ') || 'None'}
          </div>
          <div className="summary-item">
            <strong>PDF Column:</strong> {config.pdfColumn || 'None'}
          </div>
          <div className="summary-item">
            <strong>Image Folder:</strong> {config.imageFolder || 'Not set'}
          </div>
          <div className="summary-item">
            <strong>PDF Folder:</strong> {config.pdfFolder || 'Not set'}
          </div>
          <div className="summary-item">
            <strong>Source Folder:</strong> {config.sourceImageFolder || 'Not set'}
          </div>
          <div className="summary-item">
            <strong>Max Workers:</strong> {config.maxWorkers}
          </div>
          <div className="summary-item">
            <strong>Background Processing:</strong> {config.backgroundProcessing.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>
      
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <h3>Configuration Issues</h3>
          <ul className="error-list">
            {validationErrors.map((error, index) => (
              <li key={index} className="error-item">
                ❌ {error}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Configuration Status */}
      {isConfigValid && (
        <div className="config-status">
          <p className="success-message">✅ Configuration is valid and ready for downloads</p>
        </div>
      )}
      
      {/* Quick Settings */}
      <div className="quick-settings">
        <h3>Quick Settings</h3>
        
        <div className="form-group">
          <label htmlFor="image-folder-quick">Image Download Folder</label>
          <div className="folder-input-group">
            <input
              id="image-folder-quick"
              type="text"
              value={config.imageFolder}
              onChange={(e) => updateConfig({ imageFolder: e.target.value })}
              className="form-control"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleFolderSelect(
                (value) => updateConfig({ imageFolder: value }),
                config.imageFolder
              )}
            >
              Browse
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="pdf-folder-quick">PDF Download Folder</label>
          <div className="folder-input-group">
            <input
              id="pdf-folder-quick"
              type="text"
              value={config.pdfFolder}
              onChange={(e) => updateConfig({ pdfFolder: e.target.value })}
              className="form-control"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleFolderSelect(
                (value) => updateConfig({ pdfFolder: value }),
                config.pdfFolder
              )}
            >
              Browse
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="image-network-path">Image Network Path (for CSV logging)</label>
          <input
            id="image-network-path"
            type="text"
            value={config.imageFilePath}
            onChange={(e) => updateConfig({ imageFilePath: e.target.value })}
            className="form-control"
            placeholder="U:\old_g\IMAGES\ABM Product Images"
          />
          <small className="form-text">Part number and .jpg extension will be added automatically</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="pdf-network-path">PDF Network Path (for CSV logging)</label>
          <input
            id="pdf-network-path"
            type="text"
            value={config.pdfFilePath}
            onChange={(e) => updateConfig({ pdfFilePath: e.target.value })}
            className="form-control"
            placeholder="U:\old_g\IMAGES\Product pdf\'s"
          />
          <small className="form-text">Part number and .pdf extension will be added automatically</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="source-folder-quick">Source Image Folder (optional)</label>
          <div className="folder-input-group">
            <input
              id="source-folder-quick"
              type="text"
              value={config.sourceImageFolder}
              onChange={(e) => updateConfig({ sourceImageFolder: e.target.value })}
              className="form-control"
              placeholder="Optional: Folder containing source images for offline matching"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleFolderSelect(
                (value) => updateConfig({ sourceImageFolder: value }),
                config.sourceImageFolder
              )}
            >
              Browse
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="workers-quick">Concurrent Downloads: {config.maxWorkers}</label>
          <input
            id="workers-quick"
            type="range"
            min="1"
            max="20"
            value={config.maxWorkers}
            onChange={(e) => updateConfig({ maxWorkers: parseInt(e.target.value) })}
            className="form-control"
          />
        </div>
      </div>
      
      {/* Download Controls */}
      <div className="download-controls">
        <div className="btn-group">
          <button
            type="button"
            className="btn btn-success"
            onClick={handleStartDownloads}
            disabled={isDownloading || !isConfigValid}
            title={!isConfigValid ? 'Please fix configuration issues before starting downloads' : ''}
          >
            {isDownloading ? 'Downloading...' : 'Start Downloads'}
          </button>
          
          {isDownloading && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleCancelDownloads}
            >
              Cancel Downloads
            </button>
          )}
        </div>
      </div>
      
      {/* Progress Section */}
      {(isDownloading || progress.total > 0 || progress.successful > 0 || progress.failed > 0) && (
        <div className="progress-section">
          <h3>Download Progress</h3>
          
          <div className="progress-summary">
            <div className="summary-stats">
              <div className="stat-card success">
                <div className="stat-number">{progress.successful}</div>
                <div className="stat-label">Successful</div>
              </div>
              <div className="stat-card failed">
                <div className="stat-number">{progress.failed}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-card total">
                <div className="stat-number">{progress.total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card percentage">
                <div className="stat-number">{progress.percentage.toFixed(1)}%</div>
                <div className="stat-label">Complete</div>
              </div>
            </div>
          </div>
          
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getProgressBarClass()}`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            
            <div className="progress-stats">
              <div className="stat">
                <span>{formatTime(progress.elapsedTime)} elapsed</span>
              </div>
              {progress.estimatedTimeRemaining > 0 && (
                <div className="stat">
                  <span>{formatTime(progress.estimatedTimeRemaining)} remaining</span>
                </div>
              )}
              {isDownloading && (
                <div className="stat">
                  <span className="downloading-indicator">⬇️ Downloading...</span>
                </div>
              )}
            </div>
          </div>
          
          {progress.currentFile && (
            <div className="current-file">
              <strong>Current:</strong> {progress.currentFile}
            </div>
          )}
        </div>
      )}
      
      {/* Logs Section */}
      {logs.length > 0 && (
        <div className="logs-section">
          <h3>Activity Log</h3>
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessTab;
