import React, { useState, useCallback, useEffect } from 'react';
import type { UpdateInfo } from 'electron-updater';
import {
  SpreadsheetData,
  SqlConnectionDetails,
  SqlCredentialIdentity,
  SqlQueryResult,
} from '@/shared/types';
import { logger } from '@/services/LoggingService';
import { ipcService } from '@/services/IPCService';
import { configurationService } from '@/services/ConfigurationService';
import { CONSTANTS } from '@/shared/constants';

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

function resolveSqlDefaults(
  saved: SqlConnectionDetails | undefined,
  sqlSettings:
    | {
        defaultServer: string;
        defaultDatabase: string;
        defaultUsername: string;
      }
    | undefined
): { server: string; database: string; username: string } {
  return {
    server: saved?.server || sqlSettings?.defaultServer || '',
    database:
      saved?.database ||
      sqlSettings?.defaultDatabase ||
      CONSTANTS.SQL.DEFAULT_DATABASE,
    username:
      saved?.username ||
      sqlSettings?.defaultUsername ||
      CONSTANTS.SQL.DEFAULT_USERNAME,
  };
}

const buildSqlCredentialIdentityKey = (
  identity: SqlCredentialIdentity
): string =>
  [
    identity.server.trim().toLowerCase(),
    identity.database.trim().toLowerCase(),
    identity.username.trim().toLowerCase(),
  ].join('|');

const hasCompleteSqlCredentialIdentity = (
  identity: SqlCredentialIdentity
): boolean =>
  Boolean(
    identity.server.trim() &&
      identity.database.trim() &&
      identity.username.trim()
  );

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
  const [inputMode, setInputMode] = useState<'file' | 'sql'>('file');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sqlServer, setSqlServer] = useState<string>('');
  const [sqlDatabase, setSqlDatabase] = useState<string>(
    CONSTANTS.SQL.DEFAULT_DATABASE
  );
  const [sqlUsername, setSqlUsername] = useState<string>(
    CONSTANTS.SQL.DEFAULT_USERNAME
  );
  const [sqlPassword, setSqlPassword] = useState<string>('');
  const [rememberSqlPassword, setRememberSqlPassword] =
    useState<boolean>(false);
  const [savedSqlPasswordIdentityKey, setSavedSqlPasswordIdentityKey] =
    useState<string | null>(null);
  const [isSqlPasswordAutoFilled, setIsSqlPasswordAutoFilled] =
    useState<boolean>(false);
  const [credentialStatusMsg, setCredentialStatusMsg] = useState<string>('');
  const [sqlAllowedCrossDatabases, setSqlAllowedCrossDatabases] = useState<
    string[]
  >(['WebScrapes']);
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [previewData, setPreviewData] = useState<SqlQueryResult | null>(null);
  const [loadedSqlRowCount, setLoadedSqlRowCount] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [connectionSuccessMsg, setConnectionSuccessMsg] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const appVersion = process.env.APP_VERSION || 'development';
  const showUpdateBanner = Boolean(hasUpdateAvailable && updateInfo);

  const getCurrentSqlCredentialIdentity =
    useCallback((): SqlCredentialIdentity => {
      return {
        server: sqlServer.trim(),
        database: sqlDatabase.trim(),
        username: sqlUsername.trim(),
      };
    }, [sqlDatabase, sqlServer, sqlUsername]);

  useEffect(() => {
    const loadSavedSqlConnectionDetails = async () => {
      try {
        const [appConfig, userSettings] = await Promise.all([
          ipcService.loadConfig(),
          configurationService.loadUserSettings(),
        ]);
        const defaults = resolveSqlDefaults(
          appConfig?.sqlConnectionDetails,
          userSettings.sqlSettings
        );
        setSqlServer(defaults.server);
        setSqlDatabase(defaults.database);
        setSqlUsername(defaults.username);
        if (userSettings.sqlSettings?.allowedCrossDatabases) {
          setSqlAllowedCrossDatabases(
            userSettings.sqlSettings.allowedCrossDatabases
          );
        }
      } catch (err) {
        logger.warn(
          'FileSelectionTab: Failed to load saved SQL connection details',
          'FileSelectionTab',
          err
        );
      }
    };

    loadSavedSqlConnectionDetails();
  }, []);

  useEffect(() => {
    if (inputMode !== 'sql') return;

    const identity = getCurrentSqlCredentialIdentity();
    if (!hasCompleteSqlCredentialIdentity(identity)) return;

    if (sqlPassword && !isSqlPasswordAutoFilled) return;

    let isCancelled = false;
    const identityKey = buildSqlCredentialIdentityKey(identity);

    const loadSavedPassword = async () => {
      try {
        const savedPassword = await ipcService.loadSavedSqlPassword(identity);
        if (isCancelled) return;

        if (savedPassword) {
          setSqlPassword(savedPassword);
          setRememberSqlPassword(true);
          setSavedSqlPasswordIdentityKey(identityKey);
          setIsSqlPasswordAutoFilled(true);
          setCredentialStatusMsg(
            'Saved SQL password loaded for this connection.'
          );
        } else if (!sqlPassword) {
          setRememberSqlPassword(false);
          setSavedSqlPasswordIdentityKey(null);
          setIsSqlPasswordAutoFilled(false);
        }
      } catch (err) {
        if (isCancelled) return;
        setCredentialStatusMsg(
          err instanceof Error
            ? err.message
            : 'Saved SQL password could not be loaded.'
        );
      }
    };

    loadSavedPassword();

    return () => {
      isCancelled = true;
    };
  }, [
    getCurrentSqlCredentialIdentity,
    inputMode,
    isSqlPasswordAutoFilled,
    sqlPassword,
  ]);

  const handleInputModeChange = useCallback((mode: 'file' | 'sql') => {
    if (mode !== 'sql') {
      setPreviewData(null);
    }
    setError('');
    setConnectionSuccessMsg('');
    setInputMode(mode);
  }, []);

  const handleSqlIdentityFieldChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
      setter(value);
      setCredentialStatusMsg('');

      if (isSqlPasswordAutoFilled) {
        setSqlPassword('');
        setRememberSqlPassword(false);
        setSavedSqlPasswordIdentityKey(null);
        setIsSqlPasswordAutoFilled(false);
      }
    },
    [isSqlPasswordAutoFilled]
  );

  const handleSqlPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSqlPassword(e.target.value);
      setIsSqlPasswordAutoFilled(false);
      setCredentialStatusMsg('');
    },
    []
  );

  const deleteSavedSqlPasswordForCurrentIdentity = useCallback(async () => {
    const identity = getCurrentSqlCredentialIdentity();
    if (!hasCompleteSqlCredentialIdentity(identity)) return;

    await ipcService.deleteSavedSqlPassword({ identity });
    setSavedSqlPasswordIdentityKey(null);
    setIsSqlPasswordAutoFilled(false);
  }, [getCurrentSqlCredentialIdentity]);

  const handleRememberSqlPasswordChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const shouldRemember = e.target.checked;
      setRememberSqlPassword(shouldRemember);
      setCredentialStatusMsg('');

      if (shouldRemember) {
        setCredentialStatusMsg(
          'Password will be saved securely after a successful SQL connection.'
        );
        return;
      }

      try {
        await deleteSavedSqlPasswordForCurrentIdentity();
        setCredentialStatusMsg(
          'Saved SQL password removed for this connection.'
        );
      } catch (err) {
        setCredentialStatusMsg(
          err instanceof Error
            ? err.message
            : 'Saved SQL password could not be removed.'
        );
      }
    },
    [deleteSavedSqlPasswordForCurrentIdentity]
  );

  const handleForgetSavedSqlPassword = useCallback(async () => {
    setRememberSqlPassword(false);
    try {
      await deleteSavedSqlPasswordForCurrentIdentity();
      setCredentialStatusMsg('Saved SQL password removed for this connection.');
    } catch (err) {
      setCredentialStatusMsg(
        err instanceof Error
          ? err.message
          : 'Saved SQL password could not be removed.'
      );
    }
  }, [deleteSavedSqlPasswordForCurrentIdentity]);

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
        sourceType: 'file',
        sourceLabel: selectedFile,
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

  const buildSqlRequest = useCallback(
    (rowLimit: number) => ({
      server: sqlServer.trim(),
      database: sqlDatabase.trim(),
      username: sqlUsername.trim(),
      password: sqlPassword,
      query: sqlQuery.trim(),
      rowLimit,
      queryTimeoutMs: CONSTANTS.SQL.QUERY_TIMEOUT_MS,
      connectionTimeoutMs: CONSTANTS.SQL.CONNECTION_TIMEOUT_MS,
      allowedCrossDatabases: sqlAllowedCrossDatabases,
    }),
    [
      sqlAllowedCrossDatabases,
      sqlDatabase,
      sqlPassword,
      sqlQuery,
      sqlServer,
      sqlUsername,
    ]
  );

  const validateSqlInputs = useCallback(
    (requireQuery: boolean): boolean => {
      if (!sqlServer.trim()) {
        setError('Please enter a SQL Server name.');
        return false;
      }
      if (!sqlDatabase.trim()) {
        setError('Please enter a SQL database name.');
        return false;
      }
      if (!sqlUsername.trim()) {
        setError('Please enter a SQL username.');
        return false;
      }
      if (!sqlPassword) {
        setError('Please enter the SQL password.');
        return false;
      }
      if (requireQuery && !sqlQuery.trim()) {
        setError('Please enter a SQL SELECT query.');
        return false;
      }
      if (requireQuery && !/^(select|with)\b/i.test(sqlQuery.trim())) {
        setError('Only SELECT-style SQL queries are allowed.');
        return false;
      }
      return true;
    },
    [sqlDatabase, sqlPassword, sqlQuery, sqlServer, sqlUsername]
  );

  const saveSqlPasswordIfRequested = useCallback(async () => {
    if (!rememberSqlPassword) return;

    const identity = getCurrentSqlCredentialIdentity();
    if (!hasCompleteSqlCredentialIdentity(identity) || !sqlPassword) return;

    try {
      await ipcService.saveSqlPassword({ identity, password: sqlPassword });
      setSavedSqlPasswordIdentityKey(buildSqlCredentialIdentityKey(identity));
      setCredentialStatusMsg(
        'SQL password saved securely for this connection.'
      );
    } catch (err) {
      setCredentialStatusMsg(
        err instanceof Error
          ? err.message
          : 'SQL password could not be saved securely.'
      );
    }
  }, [getCurrentSqlCredentialIdentity, rememberSqlPassword, sqlPassword]);

  const handleTestSqlConnection = useCallback(async () => {
    if (!validateSqlInputs(false)) return;

    setIsLoading(true);
    setError('');
    setConnectionSuccessMsg('');
    try {
      await ipcService.testSqlConnection({
        server: sqlServer.trim(),
        database: sqlDatabase.trim(),
        username: sqlUsername.trim(),
        password: sqlPassword,
        queryTimeoutMs: CONSTANTS.SQL.QUERY_TIMEOUT_MS,
        connectionTimeoutMs: CONSTANTS.SQL.CONNECTION_TIMEOUT_MS,
      });
      await saveSqlPasswordIfRequested();
      setConnectionSuccessMsg(
        `Connected to ${sqlServer.trim()} / ${sqlDatabase.trim()}`
      );
      setLoadedSqlRowCount(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect to SQL Server.'
      );
      logger.error(
        'FileSelectionTab: SQL connection test failed',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    saveSqlPasswordIfRequested,
    sqlDatabase,
    sqlPassword,
    sqlServer,
    sqlUsername,
    validateSqlInputs,
  ]);

  const handlePreviewSqlQuery = useCallback(async () => {
    if (!validateSqlInputs(true)) return;

    setIsLoading(true);
    setError('');
    try {
      const result = await ipcService.previewSqlQuery(
        buildSqlRequest(CONSTANTS.SQL.PREVIEW_ROW_LIMIT)
      );
      await saveSqlPasswordIfRequested();
      setPreviewData(result);
      setLoadedSqlRowCount(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to preview SQL query.'
      );
      logger.error(
        'FileSelectionTab: SQL preview failed',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    } finally {
      setIsLoading(false);
    }
  }, [buildSqlRequest, saveSqlPasswordIfRequested, validateSqlInputs]);

  const handleLoadSqlQuery = useCallback(async () => {
    if (!validateSqlInputs(true)) return;

    const shouldContinue = window.confirm(
      `This will load up to ${CONSTANTS.SQL.FULL_LOAD_ROW_LIMIT.toLocaleString()} rows from SQL Server. Continue?`
    );
    if (!shouldContinue) return;

    setIsLoading(true);
    setError('');
    try {
      const result = await ipcService.loadSqlQueryData(
        buildSqlRequest(CONSTANTS.SQL.FULL_LOAD_ROW_LIMIT)
      );

      if (!result.columns.length) {
        setError('The SQL query returned no columns.');
        return;
      }

      const spreadsheetData: SpreadsheetData = {
        columns: result.columns,
        rows: result.rows,
        sheetName: 'SQL Query',
        filePath: result.sourceLabel,
        sourceType: 'sql',
        sourceLabel: result.sourceLabel,
      };

      setLoadedSqlRowCount(result.rowCount);
      await saveSqlPasswordIfRequested();
      onDataLoaded(spreadsheetData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load SQL query data.'
      );
      logger.error(
        'FileSelectionTab: SQL load failed',
        err instanceof Error ? err : new Error(String(err)),
        'FileSelectionTab'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    buildSqlRequest,
    onDataLoaded,
    saveSqlPasswordIfRequested,
    validateSqlInputs,
  ]);

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

      <h2>Input Selection</h2>
      <p>
        Select an Excel/CSV file or load rows from a SQL Server SELECT query to
        begin processing.
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="form-group">
        <label>Input Type</label>
        <div className="btn-group">
          <button
            type="button"
            className={`btn ${inputMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleInputModeChange('file')}
            disabled={isLoading}
          >
            Excel / CSV
          </button>
          <button
            type="button"
            className={`btn ${inputMode === 'sql' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleInputModeChange('sql')}
            disabled={isLoading}
          >
            SQL Server
          </button>
        </div>
      </div>

      {/* File Selection */}
      {inputMode === 'file' && (
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
      )}

      {inputMode === 'sql' && (
        <div className="sql-input-section">
          <div className="sql-grid">
            <div className="sql-connection-panel">
              <div className="form-group">
                <label htmlFor="sql-server">SQL Server</label>
                <input
                  id="sql-server"
                  type="text"
                  value={sqlServer}
                  onChange={e =>
                    handleSqlIdentityFieldChange(setSqlServer, e.target.value)
                  }
                  className="form-control"
                  placeholder="server or server\\instance"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="sql-database">Database</label>
                <input
                  id="sql-database"
                  type="text"
                  value={sqlDatabase}
                  onChange={e =>
                    handleSqlIdentityFieldChange(setSqlDatabase, e.target.value)
                  }
                  className="form-control"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="sql-username">Username</label>
                <input
                  id="sql-username"
                  type="text"
                  value={sqlUsername}
                  onChange={e =>
                    handleSqlIdentityFieldChange(setSqlUsername, e.target.value)
                  }
                  className="form-control"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="sql-password">Password</label>
                <input
                  id="sql-password"
                  type="password"
                  value={sqlPassword}
                  onChange={handleSqlPasswordChange}
                  className="form-control"
                  disabled={isLoading}
                  autoComplete="off"
                />
                <div className="sql-password-save-row">
                  <label
                    className="checkbox-label"
                    htmlFor="remember-sql-password"
                  >
                    <input
                      id="remember-sql-password"
                      type="checkbox"
                      checked={rememberSqlPassword}
                      onChange={handleRememberSqlPasswordChange}
                      disabled={isLoading}
                    />
                    Remember SQL password on this device
                  </label>
                  {savedSqlPasswordIdentityKey && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm"
                      onClick={handleForgetSavedSqlPassword}
                      disabled={isLoading}
                    >
                      Forget saved password
                    </button>
                  )}
                </div>
                <small className="text-muted">
                  Saved SQL passwords are stored using the operating system
                  credential store, not app settings.
                </small>
                {credentialStatusMsg && (
                  <small className="text-muted d-block mt-1">
                    {credentialStatusMsg}
                  </small>
                )}
              </div>

              <div className="sql-buttons-group">
                <button
                  type="button"
                  className="btn btn-secondary btn-test"
                  onClick={handleTestSqlConnection}
                  disabled={isLoading}
                >
                  Test Connection
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePreviewSqlQuery}
                  disabled={isLoading}
                >
                  Preview Query
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleLoadSqlQuery}
                  disabled={isLoading}
                >
                  Load SQL Data
                </button>
              </div>

              {connectionSuccessMsg && (
                <div className="alert alert-success mt-3 mb-0">
                  {connectionSuccessMsg}
                </div>
              )}

              {loadedSqlRowCount !== null && (
                <div className="alert alert-success mt-3 mb-0">
                  Loaded {loadedSqlRowCount.toLocaleString()} SQL rows.
                </div>
              )}
            </div>

            <div className="sql-query-panel">
              <div className="form-group sql-query-form-group">
                <label htmlFor="sql-query">SQL Query</label>
                <textarea
                  id="sql-query"
                  value={sqlQuery}
                  onChange={e => setSqlQuery(e.target.value)}
                  className="form-control sql-query-textarea"
                  placeholder="SELECT PartNumber, ImageUrl, PdfUrl FROM ..."
                  disabled={isLoading}
                />
                <small className="text-muted">
                  Query text is session-only and is not saved. Preview loads up
                  to {CONSTANTS.SQL.PREVIEW_ROW_LIMIT} rows. Full load loads up
                  to {CONSTANTS.SQL.FULL_LOAD_ROW_LIMIT.toLocaleString()} rows.
                </small>
              </div>
            </div>
          </div>

          {previewData && (
            <div className="data-summary mt-4">
              <h3>
                Preview — {previewData.rowCount} rows,{' '}
                {previewData.columns.length} columns
              </h3>
              <div className="sql-preview-table-container">
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                  }}
                >
                  <thead>
                    <tr>
                      {previewData.columns.map(col => (
                        <th
                          key={col}
                          style={{
                            padding: '6px 10px',
                            background: '#2d3748',
                            color: '#e2e8f0',
                            border: '1px solid #4a5568',
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            top: 0,
                            fontWeight: 600,
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? '#3a4556' : '#4a5568',
                        }}
                      >
                        {previewData.columns.map(col => (
                          <td
                            key={col}
                            style={{
                              padding: '4px 10px',
                              border: '1px solid #4a5568',
                              color: '#e2e8f0',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={String(row[col] ?? '')}
                          >
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sheet Selection */}
      {inputMode === 'file' && selectedFile && availableSheets.length > 0 && (
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
      {inputMode === 'file' && selectedFile && selectedSheet && (
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

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center mt-3">
          <p className="text-info">Loading input data...</p>
        </div>
      )}
    </div>
  );
};

export default FileSelectionTab;
