import React from 'react';
import { UserSettings } from '@/shared/types';
import { NumberInput } from '@/renderer/components/ui';

interface DownloadBehaviorSectionProps {
  settings: UserSettings;
  onSettingUpdate: (path: string, value: any) => void;
}

export const DownloadBehaviorSection: React.FC<
  DownloadBehaviorSectionProps
> = ({ settings, onSettingUpdate }) => {
  const handleDownloadSettingChange = (settingKey: string, value: number) => {
    onSettingUpdate(`downloadBehavior.${settingKey}`, value);
  };

  return (
    <div className="config-section">
      <h3>Download Behavior</h3>

      <div className="form-group">
        <label htmlFor="concurrent-downloads">Concurrent Downloads</label>
        <NumberInput
          value={settings.downloadBehavior.defaultConcurrentDownloads}
          onChange={value =>
            handleDownloadSettingChange('defaultConcurrentDownloads', value)
          }
          min={1}
          max={20}
          suffix="workers"
        />
        <small className="text-muted">
          Number of simultaneous downloads (1-20)
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="connection-timeout">Connection Timeout</label>
        <NumberInput
          value={settings.downloadBehavior.connectionTimeout}
          onChange={value =>
            handleDownloadSettingChange('connectionTimeout', value)
          }
          min={1}
          max={60}
          suffix="seconds"
        />
      </div>

      <div className="form-group">
        <label htmlFor="read-timeout">Read Timeout</label>
        <NumberInput
          value={settings.downloadBehavior.readTimeout}
          onChange={value => handleDownloadSettingChange('readTimeout', value)}
          min={10}
          max={300}
          suffix="seconds"
        />
      </div>

      <div className="form-group">
        <label htmlFor="retry-attempts">Retry Attempts</label>
        <NumberInput
          value={settings.downloadBehavior.retryAttempts}
          onChange={value =>
            handleDownloadSettingChange('retryAttempts', value)
          }
          min={1}
          max={10}
          suffix="attempts"
        />
      </div>
    </div>
  );
};
