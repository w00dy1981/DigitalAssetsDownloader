import { downloadConfigErrors, limits } from '@/shared/downloadSettings';
import type { WorkflowScreenProps } from '../App';
import { NumberInput } from './ui';
import ActivityLog from './process/ActivityLog';
import ProgressDisplay from './process/ProgressDisplay';
import { useDownloadLifecycle } from './process/useDownloadLifecycle';

export default function ProcessTab({ data, onChange }: WorkflowScreenProps) {
  const { options } = data;
  const { phase, progress, logs, handleStartDownloads, handleCancelDownloads } =
    useDownloadLifecycle(data);
  const validationErrors = downloadConfigErrors(options);
  const isConfigValid = validationErrors.length === 0;

  return (
    <div className="process-tab">
      <div className="process-header-compact">
        <h2 className="screen-title">Process & Download</h2>
      </div>

      <div className="process-layout">
        <div className="process-left">
          <div className="config-summary">
            <h3>Configuration Summary</h3>
            <div className="summary-grid">
              <SummaryRow label="Input Source" value={data.sourceLabel} />
              <SummaryRow label="Dataset" value={data.sheetName} />
              <SummaryRow label="Part Number" value={options.partNoColumn} />
              <SummaryRow
                label="Image Columns"
                value={options.imageColumns.join(', ') || 'None'}
              />
              <SummaryRow
                label="PDF Column"
                value={options.pdfColumn || 'None'}
              />
              <SummaryRow label="Workers" value={options.maxWorkers} />
              {options.imageColumns.length > 0 && (
                <SummaryRow
                  label="Image Network Path"
                  value={options.imageFilePath || 'None'}
                />
              )}
            </div>
          </div>

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

          {isConfigValid && (
            <div className="config-status">
              <p className="success-message">
                ✅ Configuration is valid and ready for downloads
              </p>
            </div>
          )}

          <div className="download-settings">
            <h3>Download Settings</h3>

            <div className="settings-compact">
              <div className="form-group">
                <label htmlFor="workers-quick">Concurrent Downloads</label>
                <NumberInput
                  id="workers-quick"
                  value={options.maxWorkers}
                  onChange={value => onChange({ maxWorkers: value })}
                  {...limits.workers}
                />
                <small className="form-text">
                  Number of simultaneous downloads
                </small>
              </div>

              {options.imageColumns.length > 0 && (
                <>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={options.backgroundProcessing.enabled}
                        onChange={e =>
                          onChange({
                            backgroundProcessing: {
                              ...options.backgroundProcessing,
                              enabled: e.target.checked,
                            },
                          })
                        }
                      />
                      <span className="checkbox-text">
                        Give transparent images a white background
                      </span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label htmlFor="quality">JPEG Quality</label>
                    <NumberInput
                      id="quality"
                      value={options.backgroundProcessing.quality}
                      onChange={value =>
                        onChange({
                          backgroundProcessing: {
                            ...options.backgroundProcessing,
                            quality: value,
                          },
                        })
                      }
                      {...limits.quality}
                      suffix="%"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="download-controls">
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-success"
                onClick={handleStartDownloads}
                disabled={phase !== 'idle' || !isConfigValid}
                title={
                  !isConfigValid
                    ? 'Please fix configuration issues before starting downloads'
                    : ''
                }
              >
                {phase !== 'idle' ? 'Downloading...' : 'Start Downloads'}
              </button>

              {phase !== 'idle' && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCancelDownloads}
                  disabled={phase === 'cancelling'}
                >
                  {phase === 'cancelling'
                    ? 'Cancelling...'
                    : 'Cancel Downloads'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="process-right">
          {progress && (
            <ProgressDisplay
              progress={progress}
              isDownloading={phase !== 'idle'}
            />
          )}

          <ActivityLog logs={logs} />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="summary-row">
      <span className="summary-label">{label}:</span>
      <span className="summary-value">{value}</span>
    </div>
  );
}
