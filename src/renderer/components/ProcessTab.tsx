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
      setProgress(data);
    };

    const handleComplete = (data: any) => {
      setIsDownloading(false);
      setLogs(prev => [...prev, `Download complete: ${data.successful} successful, ${data.failed} failed`]);
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
    setLogs([]);

    try {
      await window.electronAPI.startDownloads(config);
    } catch (error) {
      console.error('Error starting downloads:', error);
      setIsDownloading(false);
      setLogs(prev => [...prev, `Error starting downloads: ${error}`]);
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
            disabled={isDownloading || !config.imageFolder}
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
      {(isDownloading || progress.total > 0) && (
        <div className="progress-section">
          <h3>Download Progress</h3>
          
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getProgressBarClass()}`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            
            <div className="progress-stats">
              <div className="stat">
                <span className="text-success">✓ {progress.successful}</span>
              </div>
              <div className="stat">
                <span className="text-danger">✗ {progress.failed}</span>
              </div>
              <div className="stat">
                <span>{progress.percentage.toFixed(1)}%</span>
              </div>
              <div className="stat">
                <span>{formatTime(progress.elapsedTime)} elapsed</span>
              </div>
              {progress.estimatedTimeRemaining > 0 && (
                <div className="stat">
                  <span>{formatTime(progress.estimatedTimeRemaining)} remaining</span>
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
