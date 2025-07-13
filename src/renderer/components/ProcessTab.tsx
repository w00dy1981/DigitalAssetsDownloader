import React, { useState, useEffect, useCallback } from 'react';
import { DownloadConfig, DownloadProgress, IPC_CHANNELS } from '@/shared/types';

interface ProcessTabProps {
  config: DownloadConfig;
  onConfigurationChange: (config: DownloadConfig) => void;
}

const ProcessTab: React.FC<ProcessTabProps> = ({ config, onConfigurationChange }) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isStartPending, setIsStartPending] = useState<boolean>(false);
  const [isCancelPending, setIsCancelPending] = useState<boolean>(false);
  const [progress, setProgress] = useState<DownloadProgress>({
    currentFile: '',
    successful: 0,
    failed: 0,
    total: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    backgroundProcessed: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [workerInputValue, setWorkerInputValue] = useState<string>(config.maxWorkers.toString());
  const [startTime, setStartTime] = useState<number>(0);

  // IPC event listeners for download progress and completion
  useEffect(() => {
    const handleProgress = (data: DownloadProgress) => {
      console.log('Progress update received:', data);
      setProgress(data);
    };

    const handleComplete = (data: any) => {
      console.log('Download complete:', data);
      setIsDownloading(false);
      setIsStartPending(false);
      setIsCancelPending(false);
      
      if (data.error) {
        setLogs(prev => [...prev, `Download error: ${data.error}`]);
      } else if (data.cancelled) {
        setLogs(prev => [...prev, `Downloads cancelled: ${data.successful || 0} successful, ${data.failed || 0} failed`]);
      } else {
        const messages = [
          `Downloads complete: ${data.successful || 0} successful, ${data.failed || 0} failed`
        ];
        
        if (data.backgroundProcessed > 0) {
          messages.push(`Background processing: ${data.backgroundProcessed} images had backgrounds fixed`);
        }
        
        if (data.logFile) {
          messages.push(`Log file saved: ${data.logFile}`);
        }
        
        setLogs(prev => [...prev, ...messages]);
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);
    window.electronAPI.onDownloadComplete(handleComplete);

    return () => {
      window.electronAPI.removeAllListeners(IPC_CHANNELS.DOWNLOAD_PROGRESS as any);
      window.electronAPI.removeAllListeners(IPC_CHANNELS.DOWNLOAD_COMPLETE as any);
    };
  }, []);

  const handleStartDownloads = useCallback(async () => {
    // Atomic check - prevent multiple simultaneous start attempts
    if (isDownloading || isStartPending) {
      setLogs(prev => [...prev, 'Downloads already in progress - please wait']);
      return;
    }

    setIsStartPending(true);

    // Validate configuration
    if (!config.partNoColumn) {
      setLogs(prev => [...prev, 'Error: Please select a Part Number column']);
      setIsStartPending(false);
      return;
    }

    if (!config.imageColumns.length && !config.pdfColumn) {
      setLogs(prev => [...prev, 'Error: Please select at least one Image URL column or PDF column']);
      setIsStartPending(false);
      return;
    }

    if (!config.imageFolder && !config.pdfFolder) {
      setLogs(prev => [...prev, 'Error: Please select download folders']);
      setIsStartPending(false);
      return;
    }

    // Set downloading state immediately to prevent race conditions
    setIsDownloading(true);
    setStartTime(Date.now());
    setProgress({
      currentFile: '',
      successful: 0,
      failed: 0,
      total: 0,
      percentage: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      backgroundProcessed: 0
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
      
      // Handle specific race condition errors
      if (errorMessage.includes('Downloads already in progress')) {
        setLogs(prev => [...prev, 'Downloads already in progress - operation prevented']);
      } else {
        setLogs(prev => [...prev, `Error starting downloads: ${errorMessage}`]);
      }
      setIsDownloading(false);
    } finally {
      setIsStartPending(false);
    }
  }, [config, isDownloading, isStartPending]);

  const handleCancelDownloads = useCallback(async () => {
    if (!isDownloading || isCancelPending) {
      setLogs(prev => [...prev, 'No downloads currently running']);
      return;
    }

    setIsCancelPending(true);
    setLogs(prev => [...prev, 'Cancelling downloads...']);

    try {
      await window.electronAPI.cancelDownloads();
      setLogs(prev => [...prev, 'Downloads cancellation requested']);
    } catch (error) {
      console.error('Error cancelling downloads:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLogs(prev => [...prev, `Error cancelling downloads: ${errorMessage}`]);
      setIsDownloading(false);
    } finally {
      setIsCancelPending(false);
    }
  }, [isDownloading, isCancelPending]);

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

  // Sync worker input value when config changes
  useEffect(() => {
    setWorkerInputValue(config.maxWorkers.toString());
  }, [config.maxWorkers]);

  // Initialize default ERP paths when component mounts (only if empty)
  useEffect(() => {
    // Set default paths only if they are empty/undefined
    const updates: Partial<DownloadConfig> = {};
    
    // Keep paths empty if not configured - don't auto-assign hardcoded defaults
    // Users should configure these in Settings if needed
    
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
      <div className="process-header-compact">
        <h2>Process & Download</h2>
      </div>
      
      <div className="process-layout">
        {/* Left Column - Configuration and Controls */}
        <div className="process-left">
          {/* Configuration Summary */}
          <div className="config-summary">
            <h3>Configuration Summary</h3>
            <div className="summary-grid">
              <div className="summary-row">
                <span className="summary-label">Excel File:</span>
                <span className="summary-value">{config.excelFile.split('/').pop() || 'Unknown'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Sheet:</span>
                <span className="summary-value">{config.sheetName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Part Number:</span>
                <span className="summary-value">{config.partNoColumn}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Image Columns:</span>
                <span className="summary-value">{config.imageColumns.join(', ') || 'None'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">PDF Column:</span>
                <span className="summary-value">{config.pdfColumn || 'None'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Workers:</span>
                <span className="summary-value">{config.maxWorkers}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Background Processing:</span>
                <span className="summary-value">{config.backgroundProcessing.enabled ? 'Enabled' : 'Disabled'}</span>
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

          {/* Download Settings */}
          <div className="download-settings">
            <h3>Download Settings</h3>
            
            <div className="settings-compact">
              {/* Concurrent Downloads */}
              <div className="form-group">
                <label htmlFor="workers-quick">Concurrent Downloads</label>
                <input
                  id="workers-quick"
                  type="number"
                  min="1"
                  max="20"
                  value={workerInputValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    setWorkerInputValue(value);
                    
                    // Only update config if it's a valid number
                    if (value !== '') {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
                        updateConfig({ maxWorkers: numValue });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '' || isNaN(parseInt(value))) {
                      // Reset to current config value if invalid
                      setWorkerInputValue(config.maxWorkers.toString());
                    } else {
                      const numValue = parseInt(value);
                      if (numValue < 1) {
                        setWorkerInputValue('1');
                        updateConfig({ maxWorkers: 1 });
                      } else if (numValue > 20) {
                        setWorkerInputValue('20');
                        updateConfig({ maxWorkers: 20 });
                      }
                    }
                  }}
                  className="form-control number-input"
                  style={{ maxWidth: '120px' }}
                />
                <small className="form-text">Number of simultaneous downloads (1-20)</small>
              </div>

              {/* Background Processing */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.backgroundProcessing.enabled}
                    onChange={(e) => updateConfig({ 
                      backgroundProcessing: { 
                        ...config.backgroundProcessing, 
                        enabled: e.target.checked 
                      } 
                    })}
                  />
                  <span className="checkbox-text">Enable Background Processing</span>
                </label>
                <small className="text-muted">
                  Process downloaded images to remove backgrounds and convert to JPEG
                </small>
              </div>
              
              {config.backgroundProcessing.enabled && (
                <div className="bg-processing-options">
                  <div className="form-group-inline">
                    <div className="form-group">
                      <label htmlFor="bg-method">Processing Method</label>
                      <select
                        id="bg-method"
                        value={config.backgroundProcessing.method}
                        onChange={(e) => updateConfig({ 
                          backgroundProcessing: { 
                            ...config.backgroundProcessing, 
                            method: e.target.value as any 
                          } 
                        })}
                        className="form-control"
                        style={{ maxWidth: '200px' }}
                      >
                        <option value="smart_detect">Smart Detection</option>
                        <option value="ai_removal">AI Removal</option>
                        <option value="color_replace">Color Range Replacement</option>
                        <option value="edge_detection">Edge Detection</option>
                      </select>
                      <small className="text-muted method-explanation">
                        {config.backgroundProcessing.method === 'smart_detect' && 'Analyzes edges to detect and remove backgrounds automatically'}
                        {config.backgroundProcessing.method === 'ai_removal' && 'Uses AI to intelligently remove backgrounds (most accurate)'}
                        {config.backgroundProcessing.method === 'color_replace' && 'Replaces specific color ranges with transparency'}
                        {config.backgroundProcessing.method === 'edge_detection' && 'Uses edge detection algorithms for background removal'}
                      </small>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="quality">JPEG Quality (%)</label>
                      <input
                        id="quality"
                        type="number"
                        min="60"
                        max="100"
                        value={config.backgroundProcessing.quality}
                        onChange={(e) => updateConfig({ 
                          backgroundProcessing: { 
                            ...config.backgroundProcessing, 
                            quality: parseInt(e.target.value) || 95 
                          } 
                        })}
                        className="form-control number-input"
                        style={{ maxWidth: '120px' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Download Controls */}
          <div className="download-controls">
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-success"
                onClick={handleStartDownloads}
                disabled={isDownloading || isStartPending || !isConfigValid}
                title={!isConfigValid ? 'Please fix configuration issues before starting downloads' : ''}
              >
                {isStartPending ? 'Starting...' : isDownloading ? 'Downloading...' : 'Start Downloads'}
              </button>
              
              {(isDownloading || isCancelPending) && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCancelDownloads}
                  disabled={isCancelPending}
                >
                  {isCancelPending ? 'Cancelling...' : 'Cancel Downloads'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Column - Progress and Logs */}
        <div className="process-right">
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
                  {progress.backgroundProcessed > 0 && (
                    <div className="stat-card processed">
                      <div className="stat-number">{progress.backgroundProcessed}</div>
                      <div className="stat-label">Background Fixed</div>
                    </div>
                  )}
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
      </div>
    </div>
  );
};

export default ProcessTab;
