import React from 'react';
import { UserSettings } from '@/shared/types';
import { FormGroup } from '@/renderer/components/ui';
import { CONSTANTS } from '@/shared/constants';

interface SqlSettingsSectionProps {
  settings: UserSettings;
  onSettingUpdate: (path: string, value: any) => void;
}

export const SqlSettingsSection: React.FC<SqlSettingsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const sql = settings.sqlSettings ?? {
    defaultServer: '',
    defaultDatabase: CONSTANTS.SQL.DEFAULT_DATABASE,
    defaultUsername: CONSTANTS.SQL.DEFAULT_USERNAME,
    allowedCrossDatabases: ['WebScrapes'],
  };

  const handleChange = (key: string, value: string) => {
    onSettingUpdate(`sqlSettings.${key}`, value);
  };

  const handleCrossDatabaseChange = (value: string) => {
    const parsed = value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    onSettingUpdate('sqlSettings.allowedCrossDatabases', parsed);
  };

  return (
    <div className="config-section">
      <h3>SQL Server Defaults</h3>

      <FormGroup label="Default SQL Server" htmlFor="sql-default-server">
        <input
          id="sql-default-server"
          type="text"
          className="form-control"
          value={sql.defaultServer}
          onChange={e => handleChange('defaultServer', e.target.value)}
          placeholder="e.g. MYSERVER\SQLEXPRESS"
        />
      </FormGroup>

      <FormGroup label="Default Database" htmlFor="sql-default-database">
        <input
          id="sql-default-database"
          type="text"
          className="form-control"
          value={sql.defaultDatabase}
          onChange={e => handleChange('defaultDatabase', e.target.value)}
          placeholder={CONSTANTS.SQL.DEFAULT_DATABASE}
        />
      </FormGroup>

      <FormGroup label="Default Username" htmlFor="sql-default-username">
        <input
          id="sql-default-username"
          type="text"
          className="form-control"
          value={sql.defaultUsername}
          onChange={e => handleChange('defaultUsername', e.target.value)}
          placeholder={CONSTANTS.SQL.DEFAULT_USERNAME}
        />
      </FormGroup>

      <FormGroup
        label="Allowed Cross-Database Names"
        htmlFor="sql-cross-databases"
        helpText="Comma-separated list of databases allowed in three-part names (e.g. WebScrapes.dbo.TableName). Leave empty to allow all."
      >
        <input
          id="sql-cross-databases"
          type="text"
          className="form-control"
          value={sql.allowedCrossDatabases.join(', ')}
          onChange={e => handleCrossDatabaseChange(e.target.value)}
          placeholder="WebScrapes"
        />
      </FormGroup>

      <p
        className="help-text"
        style={{ marginTop: '0.5rem', fontSize: '0.85em', color: '#888' }}
      >
        Passwords are stored securely in the OS credential store, not here. For
        Baker → WebScrapes joins, keep <code>WebScrapes</code> in the list above
        and reference tables as <code>WebScrapes.dbo.TableName</code> in your
        query.
      </p>
    </div>
  );
};
