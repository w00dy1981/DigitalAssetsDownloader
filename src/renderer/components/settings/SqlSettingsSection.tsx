import React from 'react';
import type { UserSettings } from '@/shared/userSettings';
import { FormGroup } from '@/renderer/components/ui';
import { defaultUserSettings } from '@/shared/userSettings';

interface SqlSettingsSectionProps {
  settings: UserSettings['sqlSettings'];
  onSettingUpdate: (
    changes: Partial<NonNullable<UserSettings['sqlSettings']>>
  ) => void;
}

export const SqlSettingsSection: React.FC<SqlSettingsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const sql = settings ?? defaultUserSettings.sqlSettings;

  return (
    <div className="config-section">
      <h3>SQL Server Defaults</h3>

      <FormGroup label="Default SQL Server" htmlFor="sql-default-server">
        <input
          id="sql-default-server"
          type="text"
          className="form-control"
          value={sql.defaultServer}
          onChange={e => onSettingUpdate({ defaultServer: e.target.value })}
          placeholder="e.g. MYSERVER\SQLEXPRESS"
        />
      </FormGroup>

      <FormGroup label="Default Database" htmlFor="sql-default-database">
        <input
          id="sql-default-database"
          type="text"
          className="form-control"
          value={sql.defaultDatabase}
          onChange={e => onSettingUpdate({ defaultDatabase: e.target.value })}
          placeholder={defaultUserSettings.sqlSettings.defaultDatabase}
        />
      </FormGroup>

      <FormGroup label="Default Username" htmlFor="sql-default-username">
        <input
          id="sql-default-username"
          type="text"
          className="form-control"
          value={sql.defaultUsername}
          onChange={e => onSettingUpdate({ defaultUsername: e.target.value })}
          placeholder={defaultUserSettings.sqlSettings.defaultUsername}
        />
      </FormGroup>

      <p
        className="help-text"
        style={{ marginTop: '0.5rem', fontSize: '0.85em', color: '#888' }}
      >
        SQL Server controls which databases this login can read. Use a login
        with read-only permissions.
      </p>
    </div>
  );
};
