import React from 'react';
import { UserSettings } from '@/shared/types';
import { FormGroup } from '@/renderer/components/ui';

interface UIPreferencesSectionProps {
  settings: UserSettings;
  onSettingUpdate: (changes: Partial<UserSettings['uiPreferences']>) => void;
}

export const UIPreferencesSection: React.FC<UIPreferencesSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  return (
    <div className="config-section">
      <h3>UI Preferences</h3>

      <FormGroup helpText="File dialogs will open to the last used location">
        <label>
          <input
            type="checkbox"
            checked={settings.uiPreferences.rememberFileDialogPath}
            onChange={e =>
              onSettingUpdate({ rememberFileDialogPath: e.target.checked })
            }
          />
          Remember file dialog location
        </label>
      </FormGroup>

      <FormGroup helpText="Display advanced configuration options in other tabs">
        <label>
          <input
            type="checkbox"
            checked={settings.uiPreferences.showAdvancedOptions}
            onChange={e =>
              onSettingUpdate({ showAdvancedOptions: e.target.checked })
            }
          />
          Show advanced options
        </label>
      </FormGroup>

      <FormGroup label="Default startup tab" htmlFor="startup-tab">
        <select
          id="startup-tab"
          value={settings.uiPreferences.startupTab}
          onChange={e => {
            const startupTab = e.target.value;
            if (
              startupTab === 'file' ||
              startupTab === 'column' ||
              startupTab === 'process' ||
              startupTab === 'settings'
            ) {
              onSettingUpdate({ startupTab });
            }
          }}
          className="form-control"
        >
          <option value="file">File Selection</option>
          <option value="column">Column Selection</option>
          <option value="process">Process & Download</option>
          <option value="settings">Settings</option>
        </select>
      </FormGroup>
    </div>
  );
};
