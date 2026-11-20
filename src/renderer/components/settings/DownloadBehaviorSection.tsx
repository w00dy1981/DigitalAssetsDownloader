import { limits } from '@/shared/downloadSettings';
import React from 'react';
import type { UserSettings } from '@/shared/userSettings';
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
        helpText="Number of simultaneous downloads"
      >
        <NumberInput
          id="concurrent-downloads"
          value={settings.defaultConcurrentDownloads}
          onChange={value =>
            onSettingUpdate({ defaultConcurrentDownloads: value })
          }
          {...limits.count}
          suffix="workers"
        />
      </FormGroup>

      <FormGroup
        label="Connection Timeout"
        htmlFor="connection-timeout"
        helpText="Seconds to wait for response headers. Set to 0 to disable."
      >
        <NumberInput
          id="connection-timeout"
          value={settings.connectionTimeout}
          onChange={value => onSettingUpdate({ connectionTimeout: value })}
          {...limits.httpTimeout}
          suffix="seconds"
        />
      </FormGroup>

      <FormGroup
        label="Read Timeout"
        htmlFor="read-timeout"
        helpText="Seconds to wait between response chunks. Set to 0 to disable."
      >
        <NumberInput
          id="read-timeout"
          value={settings.readTimeout}
          onChange={value => onSettingUpdate({ readTimeout: value })}
          {...limits.httpTimeout}
          suffix="seconds"
        />
      </FormGroup>

      <FormGroup label="Maximum Download Attempts" htmlFor="retry-attempts">
        <NumberInput
          id="retry-attempts"
          value={settings.retryAttempts}
          onChange={value => onSettingUpdate({ retryAttempts: value })}
          {...limits.count}
          suffix="attempts"
        />
      </FormGroup>
    </div>
  );
};
