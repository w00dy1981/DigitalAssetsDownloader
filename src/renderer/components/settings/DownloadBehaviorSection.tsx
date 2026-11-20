import { limits } from '@/shared/downloadSettings';
import React from 'react';
import { UserSettings } from '@/shared/types';
import { NumberInput, FormGroup } from '@/renderer/components/ui';

interface DownloadBehaviorSectionProps {
  settings: UserSettings['downloadBehavior'];
  onSettingUpdate: (changes: Partial<UserSettings['downloadBehavior']>) => void;
}

export const DownloadBehaviorSection: React.FC<
  DownloadBehaviorSectionProps
> = ({ settings, onSettingUpdate }) => {
  return (
    <div className="config-section">
      <h3>Download Behavior</h3>

      <FormGroup
        label="Concurrent Downloads"
        htmlFor="concurrent-downloads"
        helpText="Number of simultaneous downloads (1-20)"
      >
        <NumberInput
          id="concurrent-downloads"
          value={settings.defaultConcurrentDownloads}
          onChange={value =>
            onSettingUpdate({ defaultConcurrentDownloads: value })
          }
          {...limits.workers}
          suffix="workers"
        />
      </FormGroup>

      <FormGroup label="Connection Timeout" htmlFor="connection-timeout">
        <NumberInput
          id="connection-timeout"
          value={settings.connectionTimeout}
          onChange={value => onSettingUpdate({ connectionTimeout: value })}
          {...limits.connectionTimeout}
          suffix="seconds"
        />
      </FormGroup>

      <FormGroup label="Read Timeout" htmlFor="read-timeout">
        <NumberInput
          id="read-timeout"
          value={settings.readTimeout}
          onChange={value => onSettingUpdate({ readTimeout: value })}
          {...limits.readTimeout}
          suffix="seconds"
        />
      </FormGroup>

      <FormGroup label="Retry Attempts" htmlFor="retry-attempts">
        <NumberInput
          id="retry-attempts"
          value={settings.retryAttempts}
          onChange={value => onSettingUpdate({ retryAttempts: value })}
          {...limits.retryAttempts}
          suffix="attempts"
        />
      </FormGroup>
    </div>
  );
};
