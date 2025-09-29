import React, { useState, useCallback } from 'react';
import type { UpdateInfo } from 'electron-updater';
import { SpreadsheetData } from '@/shared/types';
import { logger } from '@/services/LoggingService';
import { ipcService } from '@/services/IPCService';

/**
 * Update notification banner with inline update controls
 */
interface UpdateNotificationBannerProps {
  currentVersion: string;
  updateInfo: UpdateInfo;
  statusMessage?: string | null;
  isChecking?: boolean;
  isDownloading?: boolean;
  isDownloaded?: boolean;
  downloadProgress?: number | null;
  onDownload?: () => void | Promise<void>;
  onInstall?: () => void | Promise<void>;
  onDismiss?: () => void;
}

const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  currentVersion,
  updateInfo,
  statusMessage,
  isChecking = false,
  isDownloading = false,
  isDownloaded = false,
  downloadProgress,
  onDownload,
  onInstall,
  onDismiss,
}) => {
  const progressValue = Math.max(0, Math.min(100, downloadProgress ?? 0));

  const handleDownloadClick = async () => {
    if (!onDownload) return;
    try {
      await onDownload();
    } catch (error) {
      logger.error(
        'UpdateBanner: Download failed',
        error instanceof Error ? error : new Error(String(error)),
        'UpdateBanner'
      );
    }
  };

  const handleInstallClick = async () => {
    if (!onInstall) return;
    try {
      await onInstall();
    } catch (error) {
      logger.error(
        'UpdateBanner: Install failed',
        error instanceof Error ? error : new Error(String(error)),
        'UpdateBanner'
      );
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a6fd6 0%, #4c8af0 100%)',
        border: '1px solid #1456a3',
        borderRadius: '12px',
        padding: '18px',
        marginBottom: '20px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div>
        <strong style={{ fontSize: '1.1rem' }}>
          New version available: v{updateInfo.version}
        </strong>
        <div style={{ fontSize: '0.95rem', opacity: 0.9, marginTop: '4px' }}>
          Current version: v{currentVersion}
        </div>
        {statusMessage && (
          <div style={{ fontSize: '0.9rem', marginTop: '8px' }}>
            {statusMessage}
          </div>
        )}
        {isChecking && (
          <div style={{ fontSize: '0.85rem', marginTop: '8px', opacity: 0.85 }}>
            Checking for updates...
          </div>
        )}
        {isDownloading && (
          <div style={{ marginTop: '10px' }}>
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                height: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressValue}%`,
                  backgroundColor: '#00d8ff',
                  height: '100%',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>
              Downloading update... {progressValue.toFixed(0)}%
            </div>
          </div>
        )}
        {isDownloaded && (
          <div style={{ fontSize: '0.85rem', marginTop: '8px' }}>
            Update downloaded. Restart to install when ready.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-light"
          onClick={handleDownloadClick}
          disabled={isDownloading || isDownloaded}
          style={{ minWidth: '160px' }}
        >
          {isDownloading
            ? `Downloading… ${progressValue.toFixed(0)}%`
            : isDownloaded
              ? 'Update Ready'
              : 'Download Update'}
        </button>
        {isDownloaded && (
          <button
            className="btn btn-success"
            onClick={handleInstallClick}
            style={{ minWidth: '160px' }}
          >
            Install & Restart
          </button>
        )}
        <button
          className="btn btn-outline-light"
          onClick={onDismiss}
          style={{ minWidth: '140px' }}
        >
          Remind Me Later
        </button>
      </div>
    </div>
  );
};

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
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const appVersion = process.env.APP_VERSION || 'development';
  const showUpdateBanner = Boolean(hasUpdateAvailable && updateInfo);

  const handleDownloadUpdate = useCallback(async () => {
    if (!onDownloadUpdate) return;
    try {
      await onDownloadUpdate();
    } catch (err) {
      logger.error(
        'FileSelectionTab: Update download failed',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    }
  }, [onDownloadUpdate]);

  const handleInstallUpdate = useCallback(async () => {
    if (!onInstallUpdate) return;
    try {
      await onInstallUpdate();
    } catch (err) {
      logger.error(
        'FileSelectionTab: Update install failed',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    }
  }, [onInstallUpdate]);

  const handleDismissUpdate = useCallback(() => {
    if (onUpdateHandled) {
      onUpdateHandled();
    }
  }, [onUpdateHandled]);

  const loadSheetNamesForFile = useCallback(async (filePath: string) => {
    if (filePath.toLowerCase().endsWith('.csv')) {
      setAvailableSheets(['Sheet1']);
      setSelectedSheet('Sheet1');
    } else {
      setIsLoading(true);
      try {
        const sheets = await ipcService.getSheetNames(filePath);
        setAvailableSheets(sheets);
        setSelectedSheet(sheets[0] || '');
      } catch (err) {
        setError('Failed to load sheet names from the Excel file.');
        logger.error(
          'Error loading sheet names',
          err instanceof Error ? err : new Error(String(err)),
          'FileSelectionTab'
        );
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const handleFileSelect = useCallback(async () => {
    try {
      setError('');
      const result = await ipcService.openFileDialog({
        title: 'Select Excel or CSV File',
        properties: ['openFile'],
        filters: [
          {
            name: 'All Supported Files',
            extensions: ['xlsx', 'xls', 'xlsm', 'csv'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        setSelectedFile(filePath);

        // Load sheet names for Excel files
        await loadSheetNamesForFile(filePath);
      }
    } catch (err) {
      setError('Failed to open file dialog.');
      logger.error(
        'Error opening file dialog',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    }
  }, [loadSheetNamesForFile]);

  const handleSheetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedSheet(e.target.value);
    },
    []
  );

  const handleLoadSheet = useCallback(async () => {
    if (!selectedFile || !selectedSheet) {
      setError('Please select both a file and a sheet.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await ipcService.loadSheetData(selectedFile, selectedSheet);

      if (!data || !data.columns || !data.rows) {
        setError('Failed to load data from the selected sheet.');
        return;
      }

      const spreadsheetData: SpreadsheetData = {
        columns: data.columns,
        rows: data.rows,
        sheetName: selectedSheet,
        filePath: selectedFile,
      };

      onDataLoaded(spreadsheetData);
    } catch (err) {
      setError(
        'Failed to load sheet data. Please check the file format and try again.'
      );
      logger.error(
        'Error loading sheet data',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, selectedSheet, onDataLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      if (!file) return;

      // For Electron, we can access the file path with proper type checking
      let filePath: string;

      // Check if file has a path property (Electron-specific)
      if (file && typeof file === 'object' && 'path' in file) {
        const fileWithPath = file as File & { path?: string };
        filePath = fileWithPath.path || file.name;
      } else {
        filePath = file.name;
      }

      // Validate the file path is a string and not empty
      if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
        setError('Unable to get valid file path.');
        return;
      }

      // Additional security check: ensure filename doesn't contain path traversal
      if (filePath.includes('..') || filePath.includes('\0')) {
        setError('Invalid file path detected.');
        return;
      }

      const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
      const hasValidExtension = validExtensions.some(ext =>
        filePath.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        setError(
          'Please select a valid Excel (.xlsx, .xls, .xlsm) or CSV file.'
        );
        return;
      }

      setSelectedFile(filePath);
      setError('');

      // Load sheet names
      await loadSheetNamesForFile(filePath);
    },
    [loadSheetNamesForFile]
  );

  return (
    <div className="tab-panel">
      {/* Update Notification Banner */}
      {showUpdateBanner && updateInfo && (
        <UpdateNotificationBanner
          currentVersion={appVersion}
          updateInfo={updateInfo}
          statusMessage={updateStatus ?? null}
          isChecking={!!isCheckingForUpdate}
          isDownloading={!!isDownloadingUpdate}
          isDownloaded={!!isUpdateDownloaded}
          downloadProgress={updateDownloadProgress ?? null}
          onDownload={handleDownloadUpdate}
          onInstall={handleInstallUpdate}
          onDismiss={handleDismissUpdate}
        />
      )}

      <h2>File Selection</h2>
      <p>
        Select an Excel file (.xlsx, .xls, .xlsm) or CSV file to begin
        processing.
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      {/* File Selection */}
      <div className="form-group">
        <label htmlFor="file-input">Excel or CSV File</label>
        <div
          className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            id="file-input"
            type="text"
            value={selectedFile}
            readOnly
            placeholder="Click 'Browse' to select a file or drag & drop here"
            className="form-control"
          />
          <div className="d-flex align-items-center mt-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFileSelect}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Browse...'}
            </button>
            {selectedFile && (
              <span className="text-success ml-2">✓ File selected</span>
            )}
          </div>
        </div>
        <small className="text-muted">
          Supported formats: Excel (.xlsx, .xls, .xlsm) and CSV (.csv) files
          <br />
          💡 <strong>Tip:</strong> You can also drag and drop files directly
          into the area above
        </small>
      </div>

      {/* Sheet Selection */}
      {selectedFile && availableSheets.length > 0 && (
        <div className="form-group">
          <label htmlFor="sheet-select">Select Sheet</label>
          <select
            id="sheet-select"
            value={selectedSheet}
            onChange={handleSheetChange}
            className="form-control"
            disabled={isLoading}
          >
            <option value="">Choose a sheet...</option>
            {availableSheets.map(sheet => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Load Sheet Button */}
      {selectedFile && selectedSheet && (
        <div className="form-group">
          <button
            type="button"
            className="btn btn-success"
            onClick={handleLoadSheet}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Sheet'}
          </button>
        </div>
      )}

      {/* Current Data Summary */}
      {currentData && (
        <div className="data-summary mt-4">
          <h3>✅ Loaded Data Summary</h3>
          <div className="summary-card">
            <p>
              <strong>File:</strong> {currentData.filePath}
            </p>
            <p>
              <strong>Sheet:</strong> {currentData.sheetName}
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

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center mt-3">
          <p className="text-info">⏳ Loading file data...</p>
        </div>
      )}
    </div>
  );
};

export default FileSelectionTab;
