import { useEffect, useState } from 'react';
import { CONSTANTS } from '@/shared/constants';
import type { SqlConnectionDetails, SqlQueryResult } from '@/shared/types';
import type { InputWorkflowProps } from '../FileSelectionTab';
import { SqlPreview } from './SqlPreview';
import { SqlPasswordField, useSqlPassword } from './SqlPasswordField';

const connectionFields = [
  {
    field: 'server',
    label: 'SQL Server',
    missing: 'Please enter a SQL Server name.',
  },
  {
    field: 'database',
    label: 'Database',
    missing: 'Please enter a SQL database name.',
  },
  {
    field: 'username',
    label: 'Username',
    missing: 'Please enter a SQL username.',
  },
] as const;

const sqlActions = {
  test: {
    label: 'Test Connection',
    style: 'secondary btn-test',
    error: 'Failed to connect to SQL Server.',
  },
  preview: {
    label: 'Preview Query',
    style: 'primary',
    error: 'Failed to preview SQL query.',
  },
  load: {
    label: 'Load SQL Data',
    style: 'success',
    error: 'Failed to load SQL query data.',
  },
};

type SqlAction = keyof typeof sqlActions;

const {
  PREVIEW_ROW_LIMIT,
  FULL_LOAD_ROW_LIMIT,
  QUERY_TIMEOUT_MS,
  CONNECTION_TIMEOUT_MS,
} = CONSTANTS.SQL;
const credentialPart = (text: string) => text.trim().toLowerCase();

export function SqlInput({
  active,
  loading,
  setLoading,
  setError,
  onDataLoaded,
}: InputWorkflowProps & { active: boolean }) {
  const [connection, setConnection] = useState<
    (SqlConnectionDetails & { allowedCrossDatabases?: string[] }) | null
  >(null);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<SqlQueryResult | null>(null);
  const [notice, setNotice] = useState('');

  const credentials = useSqlPassword(
    {
      server: credentialPart(connection?.server ?? ''),
      database: credentialPart(connection?.database ?? ''),
      username: credentialPart(connection?.username ?? ''),
    },
    active,
    setLoading
  );

  useEffect(() => {
    async function loadDefaults() {
      const [appConfig, settings] = await Promise.all([
        window.electronAPI.loadConfig().catch(() => null),
        window.electronAPI.loadSettings(),
      ]);
      const saved = appConfig?.sqlConnectionDetails;
      const defaults = settings.sqlSettings;
      setConnection({
        server: saved?.server || defaults?.defaultServer || '',
        database:
          saved?.database ||
          defaults?.defaultDatabase ||
          CONSTANTS.SQL.DEFAULT_DATABASE,
        username:
          saved?.username ||
          defaults?.defaultUsername ||
          CONSTANTS.SQL.DEFAULT_USERNAME,
        allowedCrossDatabases: defaults?.allowedCrossDatabases,
      });
    }
    void loadDefaults();
  }, []);

  useEffect(() => {
    if (!active) {
      setPreview(null);
      setNotice('');
    }
  }, [active]);

  function resetResult() {
    setPreview(null);
    setNotice('');
  }

  function changeConnection(field: keyof SqlConnectionDetails, value: string) {
    if (!connection) return;
    if (credentialPart(connection[field]) !== credentialPart(value)) {
      credentials.clearPassword();
    }
    setConnection({ ...connection, [field]: value });
    resetResult();
  }

  async function runSql(action: SqlAction) {
    if (!connection || loading) return;

    const request = {
      server: connection.server.trim(),
      database: connection.database.trim(),
      username: connection.username.trim(),
      password: credentials.password.value,
      queryTimeoutMs: QUERY_TIMEOUT_MS,
      connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
    };
    const field = connectionFields.find(({ field }) => !request[field]);
    if (field) {
      setError(field.missing);
      return;
    }
    if (!request.password) {
      setError('Please enter the SQL password.');
      return;
    }
    if (action !== 'test' && !query.trim()) {
      setError('Please enter a SQL SELECT query.');
      return;
    }
    if (action === 'load') {
      if (!preview) return;
      const rowCount = preview.totalRowCount ?? preview.rowCount;
      const message =
        rowCount > FULL_LOAD_ROW_LIMIT
          ? `This query has ${rowCount.toLocaleString()} rows. This will load the first ${FULL_LOAD_ROW_LIMIT.toLocaleString()} rows from SQL Server. Continue?`
          : `This will load ${rowCount.toLocaleString()} rows from SQL Server. Continue?`;
      if (!window.confirm(message)) return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (action === 'test') {
        await window.electronAPI.testSqlConnection(request);
        await credentials.savePassword();
        setNotice(`Connected to ${request.server} / ${request.database}`);
        return;
      }

      const sql = {
        ...request,
        query: query.trim(),
        allowedCrossDatabases: connection.allowedCrossDatabases,
      };
      const isPreview = action === 'preview';
      if (isPreview) setPreview(null);
      const result = isPreview
        ? await window.electronAPI.previewSqlQuery({
            ...sql,
            rowLimit: PREVIEW_ROW_LIMIT,
          })
        : await window.electronAPI.loadSqlQueryData({
            ...sql,
            rowLimit: FULL_LOAD_ROW_LIMIT,
          });

      if (!isPreview && !result.columns.length) {
        setError('The SQL query returned no columns.');
        return;
      }

      await credentials.savePassword();
      if (isPreview) {
        setPreview(result);
      } else {
        setNotice(`Loaded ${result.rowCount.toLocaleString()} SQL rows.`);
        onDataLoaded({
          columns: result.columns,
          rows: result.rows,
          sheetName: 'SQL Query',
          filePath: result.sourceLabel,
          sourceType: 'sql',
          sourceLabel: result.sourceLabel,
        });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : sqlActions[action].error
      );
    } finally {
      setLoading(false);
    }
  }

  if (!connection) return <p role="status">Loading SQL settings...</p>;

  return (
    <div className="sql-input-section">
      <div className="sql-grid">
        <div className="sql-connection-panel">
          {connectionFields.map(({ field, label }) => (
            <div className="form-group" key={field}>
              <label htmlFor={`sql-${field}`}>{label}</label>
              <input
                id={`sql-${field}`}
                type="text"
                value={connection[field]}
                onChange={e => changeConnection(field, e.target.value)}
                className="form-control"
                placeholder={
                  field === 'server' ? 'server or server\\instance' : undefined
                }
                disabled={loading}
              />
            </div>
          ))}

          <SqlPasswordField
            credentials={credentials}
            loading={loading}
            onEdit={resetResult}
          />

          <div className="sql-buttons-group">
            {(['test', 'preview', 'load'] as const).map(action => (
              <button
                type="button"
                key={action}
                className={`btn btn-${sqlActions[action].style}`}
                onClick={() => void runSql(action)}
                disabled={loading || (action === 'load' && !preview)}
                title={
                  action === 'load' && !preview
                    ? 'Preview the SQL query before loading data'
                    : undefined
                }
              >
                {sqlActions[action].label}
              </button>
            ))}
          </div>

          {notice && (
            <div role="status" className="alert alert-success mt-3 mb-0">
              {notice}
            </div>
          )}
        </div>

        <div className="sql-query-panel">
          <div className="form-group sql-query-form-group">
            <label htmlFor="sql-query">SQL Query</label>
            <textarea
              id="sql-query"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                resetResult();
              }}
              className="form-control sql-query-textarea"
              placeholder="SELECT PartNumber, ImageUrl, PdfUrl FROM ..."
              disabled={loading}
            />
            <small className="text-muted">
              Query text is only kept for this session. Preview shows up to{' '}
              {PREVIEW_ROW_LIMIT} rows. Load SQL Data can load up to{' '}
              {FULL_LOAD_ROW_LIMIT.toLocaleString()} rows.
            </small>
          </div>
        </div>
      </div>

      {preview && <SqlPreview preview={preview} />}
    </div>
  );
}
