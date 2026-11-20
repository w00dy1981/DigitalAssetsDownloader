import { useEffect, useState } from 'react';
import type { SqlCredentialIdentity } from '@/sql/contracts';

const emptyPassword = {
  value: '',
  remember: false,
  saved: false,
  checked: false,
  status: '',
};

export function useSqlPassword(
  identity: SqlCredentialIdentity,
  active: boolean,
  setLoading: (loading: boolean) => void
) {
  const [password, setPassword] = useState(emptyPassword);
  const { server, database, username } = identity;
  const complete = Boolean(server && database && username);

  useEffect(() => {
    if (!active || !complete || password.checked) return;

    let cancelled = false;
    async function loadSavedPassword() {
      try {
        const saved = await window.electronAPI.loadSavedSqlPassword({
          server,
          database,
          username,
        });
        if (cancelled) return;

        setPassword(current =>
          saved && current === emptyPassword
            ? {
                value: saved,
                remember: true,
                saved: true,
                checked: true,
                status: 'Saved SQL password loaded for this connection.',
              }
            : { ...current, saved: Boolean(saved), checked: true }
        );
      } catch (error) {
        if (cancelled) return;
        setPassword(current => ({
          ...current,
          checked: true,
          status:
            error instanceof Error
              ? error.message
              : 'Saved SQL password could not be loaded.',
        }));
      }
    }
    void loadSavedPassword();
    return () => {
      cancelled = true;
    };
  }, [active, complete, server, database, username, password.checked]);

  function editPassword(value: string) {
    setPassword(current => ({ ...current, value, status: '' }));
  }

  async function rememberPassword(remember: boolean) {
    setPassword(current => ({
      ...current,
      remember,
      status: remember
        ? 'Password will be saved securely after a successful SQL connection.'
        : '',
    }));
    if (remember || !complete) return;

    setLoading(true);
    try {
      await window.electronAPI.deleteSavedSqlPassword({ identity });
      setPassword(current => ({
        ...current,
        saved: false,
        status: 'Saved SQL password removed for this connection.',
      }));
    } catch (error) {
      setPassword(current => ({
        ...current,
        status:
          error instanceof Error
            ? error.message
            : 'Saved SQL password could not be removed.',
      }));
    } finally {
      setLoading(false);
    }
  }

  async function savePassword() {
    if (!password.remember) return;
    try {
      await window.electronAPI.saveSqlPassword({
        identity,
        password: password.value,
      });
      setPassword(current => ({
        ...current,
        saved: true,
        status: 'SQL password saved securely for this connection.',
      }));
    } catch (error) {
      setPassword(current => ({
        ...current,
        status:
          error instanceof Error
            ? error.message
            : 'SQL password could not be saved securely.',
      }));
    }
  }

  return {
    password,
    checking: complete && !password.checked,
    clearPassword: () => setPassword(emptyPassword),
    editPassword,
    rememberPassword,
    savePassword,
  };
}

export function SqlPasswordField({
  credentials,
  loading,
  onEdit,
}: {
  credentials: ReturnType<typeof useSqlPassword>;
  loading: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="form-group">
      <label htmlFor="sql-password">Password</label>
      <input
        id="sql-password"
        type="password"
        value={credentials.password.value}
        onChange={e => {
          credentials.editPassword(e.target.value);
          onEdit();
        }}
        className="form-control"
        disabled={loading}
        autoComplete="off"
      />
      <div className="sql-password-save-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={credentials.password.remember}
            onChange={e => void credentials.rememberPassword(e.target.checked)}
            disabled={loading || credentials.checking}
          />
          Remember SQL password on this device
        </label>
        {credentials.password.saved && (
          <button
            type="button"
            className="btn btn-link btn-sm"
            onClick={() => void credentials.rememberPassword(false)}
            disabled={loading}
          >
            Forget saved password
          </button>
        )}
      </div>
      <small className="text-muted">
        Saved passwords are encrypted using this device’s secure storage.
      </small>
      {credentials.password.status && (
        <small role="status" className="text-muted d-block mt-1">
          {credentials.password.status}
        </small>
      )}
    </div>
  );
}
