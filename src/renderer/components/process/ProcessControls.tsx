import { downloadConfigErrors, limits } from '@/shared/downloadSettings';
import React from 'react';
import { DownloadConfig } from '@/shared/types';
import { NumberInput } from '@/renderer/components/ui';

interface ProcessControlsProps {
  config: DownloadConfig;
  onConfigurationChange: (config: DownloadConfig) => void;
  isDownloading: boolean;
  isCancelPending: boolean;
  onStartDownloads: () => void;
  onCancelDownloads: () => void;
}

const ProcessControls: React.FC<ProcessControlsProps> = ({
  config,
  onConfigurationChange,
  isDownloading,
  isCancelPending,
  onStartDownloads,
  onCancelDownloads,
}) => {
  function updateConfig(updates: Partial<DownloadConfig>) {
    onConfigurationChange({ ...config, ...updates });
  }

  const validationErrors = downloadConfigErrors(config);
  const isConfigValid = validationErrors.length === 0;

  return (
    <div className="process-left">
      {/* Configuration Summary */}
      <div className="config-summary">
        <h3>Configuration Summary</h3>
        <div className="summary-grid">
          <div className="summary-row">
            <span className="summary-label">Input Source:</span>
            <span className="summary-value">
              {config.sourceLabel ||
                config.excelFile.split('/').pop() ||
                'Unknown'}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Dataset:</span>
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
              id="workers-quick"
              value={config.maxWorkers}
              onChange={value => updateConfig({ maxWorkers: value })}
              {...limits.workers}
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
                  <small className="text-muted method-explanation">
                    Detects PNG images with transparency and converts them to
                    JPG with white background
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="quality">JPEG Quality (%)</label>
                  <NumberInput
                    id="quality"
                    value={config.backgroundProcessing.quality}
                    onChange={value =>
                      updateConfig({
                        backgroundProcessing: {
                          ...config.backgroundProcessing,
                          quality: value,
                        },
                      })
                    }
                    {...limits.quality}
                    suffix="%"
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
            disabled={isDownloading || !isConfigValid}
            title={
              !isConfigValid
                ? 'Please fix configuration issues before starting downloads'
                : ''
            }
          >
            {isDownloading ? 'Downloading...' : 'Start Downloads'}
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
