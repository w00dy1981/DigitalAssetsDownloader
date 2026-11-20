import { defaultUserSettings } from '@/shared/userSettings';
import { useEffect, useState } from 'react';
import type { SqlConnectionDetails, SqlExecution } from '@/sql/contracts';
import type { InputWorkflowProps } from '../InputSelectionTab';
import { SqlPreview } from './SqlPreview';
import { SqlPasswordField, useSqlPassword } from './SqlPasswordField';

const connectionFields = [
  { field: 'server', label: 'SQL Server' },
  { field: 'database', label: 'Database' },
  { field: 'username', label: 'Username' },
] as const;

const credentialPart = (text: string) => text.trim().toLowerCase();

export function SqlInput({
  active,
  fileLoadId,
  loading,
  setLoading,
  setError,
  onDataLoaded,
}: InputWorkflowProps & { active: boolean; fileLoadId: number }) {
  const [connection, setConnection] = useState<SqlConnectionDetails | null>(
    null
  );
  const [query, setQuery] = useState('');
  const [execution, setExecution] = useState<SqlExecution | null>(null);
  const [resultIndex, setResultIndex] = useState(0);
  const preview = execution?.results[resultIndex];
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
    void window.electronAPI
      .loadSqlConnectionDetails()
      .then(setConnection, () => {
        const defaults = defaultUserSettings.sqlSettings;
        setConnection({
          server: defaults.defaultServer,
          database: defaults.defaultDatabase,
          username: defaults.defaultUsername,
        });
      });
  }, []);

  useEffect(() => {
    setExecution(null);
    setNotice('');
  }, [fileLoadId]);

  function resetResult() {
    setExecution(null);
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

  async function runSql(action: 'test' | 'run' | 'select') {
    if (!connection || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (action === 'select') {
        if (execution)
          onDataLoaded(
            await window.electronAPI.selectSqlResult(
              execution.executionId,
              resultIndex
            )
          );
        return;
      }
      const request = { ...connection, password: credentials.password.value };
      if (action === 'test') {
        await window.electronAPI.testSqlConnection(request);
        setNotice(
          `Connected to ${[request.server, request.database].filter(Boolean).join(' / ')}`
        );
      } else {
        setExecution(null);
        const result = await window.electronAPI.executeSqlQuery({
          ...request,
          query,
        });
        setExecution(result);
        setResultIndex(0);
        if (!result.results.length)
          setNotice('SQL completed without returning a table.');
      }
      await credentials.savePassword();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
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
            <button
              type="button"
              className="btn btn-secondary btn-test"
              onClick={() => void runSql('test')}
              disabled={loading}
            >
              Test Connection
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void runSql('run')}
              disabled={loading || !query.trim()}
            >
              Run SQL
            </button>
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
              Run SQL executes the batch with this login's permissions. Leave
              Database blank to use the login’s default database.
            </small>
          </div>
        </div>
      </div>

      {execution && preview && (
        <div>
          {execution.results.length > 1 && (
            <div className="form-group">
              <label htmlFor="sql-result-set">Result set</label>
              <select
                className="form-control"
                id="sql-result-set"
                value={resultIndex}
                disabled={loading}
                onChange={e => setResultIndex(Number(e.target.value))}
              >
                {execution.results.map((result, index) => (
                  <option value={index} key={index}>
                    Result {index + 1} ({result.totalRowCount.toLocaleString()}{' '}
                    rows)
                  </option>
                ))}
              </select>
            </div>
          )}
          <SqlPreview preview={preview} />
          <button
            type="button"
            className="btn btn-success"
            disabled={loading}
            onClick={() => void runSql('select')}
          >
            Use Result
          </button>
        </div>
      )}
    </div>
  );
}
