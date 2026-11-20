import { limits } from '@/shared/downloadSettings';
import React from 'react';
import { UserSettings } from '@/shared/types';

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
          Enable background processing by default
        </label>
        <small className="text-muted">
          Automatically enable background processing for new configurations
        </small>
      </div>

      <div className="form-group">
        <small className="text-muted">
          Detects PNG images with transparency and converts them to JPG with
          white background
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="jpeg-quality">JPEG Quality</label>
        <div className="number-input-group">
          <input
            id="jpeg-quality"
            type="number"
            {...limits.quality}
            value={settings.defaultQuality}
            onChange={e =>
              onSettingUpdate({ defaultQuality: parseInt(e.target.value) })
            }
            className="form-control number-input"
          />
          <span className="input-suffix">%</span>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="edge-threshold">Edge Detection Threshold</label>
        <div className="number-input-group">
          <input
            id="edge-threshold"
            type="number"
            {...limits.edgeThreshold}
            value={settings.defaultEdgeThreshold}
            onChange={e =>
              onSettingUpdate({
                defaultEdgeThreshold: parseInt(e.target.value),
              })
            }
            className="form-control number-input"
          />
        </div>
      </div>
    </div>
  );
};
