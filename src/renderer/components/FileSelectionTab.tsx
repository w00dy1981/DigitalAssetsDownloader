import { useState } from 'react';
import type { UpdateInfo } from 'electron-updater';
import { SpreadsheetData } from '@/shared/types';
import { FileInput } from './input/FileInput';
import { SqlInput } from './input/SqlInput';
import { UpdateNotificationBanner } from './input/UpdateNotificationBanner';

interface FileSelectionTabProps {
  onDataLoaded: (data: SpreadsheetData) => void;
  currentData: SpreadsheetData | null;
  hasUpdateAvailable?: boolean;
  updateInfo?: UpdateInfo | null;
  updateStatus?: string | null;
  isCheckingForUpdate?: boolean;
  isDownloadingUpdate?: boolean;
  updateDownloadProgress?: number | null;
  isUpdateDownloaded?: boolean;
  onDownloadUpdate?: () => Promise<void> | void;
  onInstallUpdate?: () => Promise<void> | void;
  onUpdateHandled?: () => void;
}

export interface InputWorkflowProps {
  onDataLoaded: (data: SpreadsheetData) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (message: string) => void;
}

const FileSelectionTab: React.FC<FileSelectionTabProps> = ({
  onDataLoaded,
  currentData,
  hasUpdateAvailable,
  updateInfo,
  updateStatus,
  isCheckingForUpdate,
  isDownloadingUpdate,
  updateDownloadProgress,
  isUpdateDownloaded,
  onDownloadUpdate,
  onInstallUpdate,
  onUpdateHandled,
}) => {
  const [mode, setMode] = useState<'file' | 'sql'>('file');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const workflow = { onDataLoaded, loading, setLoading, setError };

  return (
    <div className="input-tab">
      {hasUpdateAvailable && updateInfo && (
        <UpdateNotificationBanner
          currentVersion={process.env.APP_VERSION || 'development'}
          updateInfo={updateInfo}
          statusMessage={updateStatus}
          isChecking={isCheckingForUpdate}
          isDownloading={isDownloadingUpdate}
          isDownloaded={isUpdateDownloaded}
          downloadProgress={updateDownloadProgress}
          onDownload={onDownloadUpdate}
          onInstall={onInstallUpdate}
          onDismiss={onUpdateHandled}
        />
      )}

      <h2 className="screen-title">Input Selection</h2>
      {error && (
        <div role="alert" className="alert alert-danger mb-3">
          {error}
        </div>
      )}
      <div className="form-group">
        <div className="btn-group" role="group" aria-label="Input type">
          {(['file', 'sql'] as const).map(source => (
            <button
              key={source}
              type="button"
              className={`btn ${mode === source ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={mode === source}
              disabled={loading}
              onClick={() => {
                if (mode === source) return;
                setError('');
                setMode(source);
              }}
            >
              {source === 'file' ? 'Excel / CSV' : 'SQL Server'}
            </button>
          ))}
        </div>
      </div>

      <div hidden={mode !== 'file'}>
        <FileInput {...workflow} />
      </div>
      <div hidden={mode !== 'sql'}>
        <SqlInput {...workflow} active={mode === 'sql'} />
      </div>

      {currentData && (
        <div className="data-summary mt-4">
          <h3>Loaded Data Summary</h3>
          <div className="summary-card">
            <p>
              <strong>Input Source:</strong>{' '}
              {currentData.sourceLabel || currentData.filePath}
            </p>
            <p>
              <strong>Dataset:</strong> {currentData.sheetName}
            </p>
            <p>
              <strong>Columns:</strong> {currentData.columns.length} (
              {currentData.columns.slice(0, 3).join(', ')}
              {currentData.columns.length > 3 ? '...' : ''})
            </p>
            <p>
              <strong>Rows:</strong> {currentData.rows.length} data rows
            </p>
            <p className="text-success">
              <strong>Status:</strong> Ready for column mapping
            </p>
          </div>
        </div>
      )}

      {loading && (
        <p role="status" className="text-center text-info mt-3">
          Loading input data...
        </p>
      )}
    </div>
  );
};

export default FileSelectionTab;
