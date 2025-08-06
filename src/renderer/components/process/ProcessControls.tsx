import React, { useCallback } from 'react';
import { DownloadConfig } from '@/shared/types';
import { NumberInput } from '@/renderer/components/ui';
import { logger } from '@/services/LoggingService';

interface ProcessControlsProps {
  config: DownloadConfig;
  onConfigurationChange: (config: DownloadConfig) => void;
  isDownloading: boolean;
  isStartPending: boolean;
  isCancelPending: boolean;
  onStartDownloads: () => void;
  onCancelDownloads: () => void;
}

const ProcessControls: React.FC<ProcessControlsProps> = ({
  config,
  onConfigurationChange,
  isDownloading,
  isStartPending,
  isCancelPending,
  onStartDownloads,
  onCancelDownloads,
}) => {
  const updateConfig = useCallback(
    (updates: Partial<DownloadConfig>) => {
      logger.info(
        'ProcessControls: Configuration updated',
        'ProcessControls',
        updates
      );
      onConfigurationChange({ ...config, ...updates });
    },
    [config, onConfigurationChange]
  );

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];

    if (!config.partNoColumn) {
      errors.push('Part Number column is required');
    }

    if (!config.imageColumns.length && !config.pdfColumn) {
      errors.push('At least one Image URL column or PDF column is required');
    }

    if (config.imageColumns.length > 0 && !config.imageFolder) {
      errors.push(
        'Image download folder is required when image columns are selected'
      );
    }

    if (config.pdfColumn && !config.pdfFolder) {
      errors.push(
        'PDF download folder is required when PDF column is selected'
      );
    }

    return errors;
  };

  const validationErrors = getValidationErrors();
  const isConfigValid = validationErrors.length === 0;

  return (
    <div className="process-left">
      {/* Configuration Summary */}
      <div className="config-summary">
        <h3>Configuration Summary</h3>
        <div className="summary-grid">
          <div className="summary-row">
            <span className="summary-label">Excel File:</span>
            <span className="summary-value">
              {config.excelFile.split('/').pop() || 'Unknown'}
            </span>
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
            <span className="summary-value">
              {config.imageColumns.join(', ') || 'None'}
            </span>
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
            <span className="summary-value">
              {config.backgroundProcessing.enabled ? 'Enabled' : 'Disabled'}
            </span>
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
          <p className="success-message">
            ✅ Configuration is valid and ready for downloads
          </p>
        </div>
      )}

      {/* Download Settings */}
      <div className="download-settings">
        <h3>Download Settings</h3>

        <div className="settings-compact">
          {/* Concurrent Downloads */}
          <div className="form-group">
            <label htmlFor="workers-quick">Concurrent Downloads</label>
            <NumberInput
              value={config.maxWorkers}
              onChange={value => updateConfig({ maxWorkers: value })}
              min={1}
              max={20}
              style={{ maxWidth: '120px' }}
            />
            <small className="form-text">
              Number of simultaneous downloads (1-20)
            </small>
          </div>

          {/* Background Processing */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.backgroundProcessing.enabled}
                onChange={e =>
                  updateConfig({
                    backgroundProcessing: {
                      ...config.backgroundProcessing,
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              <span className="checkbox-text">
                Enable Background Processing
              </span>
            </label>
            <small className="text-muted">
              Process downloaded images to remove backgrounds and convert to
              JPEG
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
                    onChange={e =>
                      updateConfig({
                        backgroundProcessing: {
                          ...config.backgroundProcessing,
                          method: e.target.value as any,
                        },
                      })
                    }
                    className="form-control"
                    style={{ maxWidth: '200px' }}
                  >
                    <option value="smart_detect">Smart Detection</option>
                    <option value="ai_removal">AI Removal</option>
                    <option value="color_replace">
                      Color Range Replacement
                    </option>
                    <option value="edge_detection">Edge Detection</option>
                  </select>
                  <small className="text-muted method-explanation">
                    {config.backgroundProcessing.method === 'smart_detect' &&
                      'Analyzes edges to detect and remove backgrounds automatically'}
                    {config.backgroundProcessing.method === 'ai_removal' &&
                      'Uses AI to intelligently remove backgrounds (most accurate)'}
                    {config.backgroundProcessing.method === 'color_replace' &&
                      'Replaces specific color ranges with transparency'}
                    {config.backgroundProcessing.method === 'edge_detection' &&
                      'Uses edge detection algorithms for background removal'}
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="quality">JPEG Quality (%)</label>
                  <NumberInput
                    value={config.backgroundProcessing.quality}
                    onChange={value =>
                      updateConfig({
                        backgroundProcessing: {
                          ...config.backgroundProcessing,
                          quality: value,
                        },
                      })
                    }
                    min={60}
                    max={100}
                    suffix="%"
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
            onClick={onStartDownloads}
            disabled={isDownloading || isStartPending || !isConfigValid}
            title={
              !isConfigValid
                ? 'Please fix configuration issues before starting downloads'
                : ''
            }
          >
            {isStartPending
              ? 'Starting...'
              : isDownloading
                ? 'Downloading...'
                : 'Start Downloads'}
          </button>

          {(isDownloading || isCancelPending) && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onCancelDownloads}
              disabled={isCancelPending}
            >
              {isCancelPending ? 'Cancelling...' : 'Cancel Downloads'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessControls;
