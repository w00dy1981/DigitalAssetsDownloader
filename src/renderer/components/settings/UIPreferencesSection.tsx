import React from 'react';
import { UserSettings } from '@/shared/types';
import { FormGroup } from '@/renderer/components/ui';

interface UIPreferencesSectionProps {
  settings: UserSettings;
  onSettingUpdate: (path: string, value: any) => void;
}

export const UIPreferencesSection: React.FC<UIPreferencesSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const handleUIPreferenceChange = (settingKey: string, value: any) => {
    onSettingUpdate(`uiPreferences.${settingKey}`, value);
  };

  return (
    <div className="config-section">
      <h3>UI Preferences</h3>

      <FormGroup helpText="File dialogs will open to the last used location">
        <label>
          <input
            type="checkbox"
            checked={settings.uiPreferences.rememberFileDialogPath}
            onChange={e =>
              handleUIPreferenceChange(
                'rememberFileDialogPath',
                e.target.checked
              )
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
              handleUIPreferenceChange('showAdvancedOptions', e.target.checked)
            }
          />
          Show advanced options
        </label>
      </FormGroup>

      <FormGroup label="Default startup tab" htmlFor="startup-tab">
        <select
          id="startup-tab"
          value={settings.uiPreferences.startupTab}
          onChange={e => handleUIPreferenceChange('startupTab', e.target.value)}
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
