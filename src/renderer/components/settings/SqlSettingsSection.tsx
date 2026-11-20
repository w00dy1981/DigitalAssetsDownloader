import { limits } from '@/shared/downloadSettings';
import React from 'react';
import type { UserSettings } from '@/shared/userSettings';
import { FormGroup, NumberInput } from '@/renderer/components/ui';
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

      <FormGroup
        label="SQL request timeout"
        htmlFor="sql-request-timeout"
        helpText="Time to wait for the first server response. Enter 0 for no request timeout."
      >
        <NumberInput
          id="sql-request-timeout"
          value={sql.queryTimeoutMs}
          step="any"
          suffix="ms"
          onChange={queryTimeoutMs => onSettingUpdate({ queryTimeoutMs })}
        />
      </FormGroup>

      <FormGroup
        label="SQL preview rows"
        htmlFor="sql-preview-rows"
        helpText="Rows to display from each result. All rows remain available for mapping."
      >
        <NumberInput
          id="sql-preview-rows"
          value={sql.previewRows}
          {...limits.previewRows}
          onChange={previewRows => onSettingUpdate({ previewRows })}
        />
      </FormGroup>
    </div>
  );
};
