import { limits } from '@/shared/downloadSettings';
import React from 'react';
import type { UserSettings } from '@/shared/userSettings';
import { NumberInput } from '@/renderer/components/ui';

interface ImageProcessingSectionProps {
  settings: UserSettings['imageProcessing'];
  onSettingUpdate: (changes: Partial<UserSettings['imageProcessing']>) => void;
}

export const ImageProcessingSection: React.FC<ImageProcessingSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  return (
    <div className="config-section">
      <h3>Image Processing</h3>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enabledByDefault}
            onChange={e =>
              onSettingUpdate({ enabledByDefault: e.target.checked })
            }
          />
          Give transparent images a white background by default
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="jpeg-quality">JPEG Quality</label>
        <NumberInput
          id="jpeg-quality"
          value={settings.defaultQuality}
          onChange={value => onSettingUpdate({ defaultQuality: value })}
          {...limits.quality}
          suffix="%"
        />
      </div>
    </div>
  );
};
