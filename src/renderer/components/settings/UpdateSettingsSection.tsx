import React from 'react';
import type { UserSettings } from '@/shared/userSettings';
import { CheckForUpdates } from '../updater/CheckForUpdates';

interface UpdateSettingsSectionProps {
  settings: UserSettings['updateSettings'];
  onSettingUpdate: (changes: Partial<UserSettings['updateSettings']>) => void;
}

export const UpdateSettingsSection: React.FC<UpdateSettingsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  return (
    <div className="config-section">
      <h3>Update Settings</h3>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enableAutoUpdates}
            onChange={e =>
              onSettingUpdate({ enableAutoUpdates: e.target.checked })
            }
          />
          Enable automatic updates
        </label>
        <small className="text-muted">
          Allow the application to check for updates when it starts. You choose
          when to download and install them.
        </small>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.checkForUpdatesOnStartup}
            onChange={e =>
              onSettingUpdate({ checkForUpdatesOnStartup: e.target.checked })
            }
            disabled={!settings.enableAutoUpdates}
          />
          Check for updates on startup
        </label>
        <small className="text-muted">
          Automatically check for updates when the application starts
        </small>
      </div>

      <CheckForUpdates />
    </div>
  );
};
