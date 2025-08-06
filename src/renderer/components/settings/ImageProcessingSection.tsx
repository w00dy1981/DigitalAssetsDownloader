import React from 'react';
import { UserSettings } from '@/shared/types';

interface ImageProcessingSectionProps {
  settings: UserSettings;
  onSettingUpdate: (path: string, value: any) => void;
}

export const ImageProcessingSection: React.FC<ImageProcessingSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const handleImageProcessingSettingChange = (
    settingKey: string,
    value: any
  ) => {
    onSettingUpdate(`imageProcessing.${settingKey}`, value);
  };

  return (
    <div className="config-section">
      <h3>Image Processing</h3>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.imageProcessing.enabledByDefault}
            onChange={e =>
              handleImageProcessingSettingChange(
                'enabledByDefault',
                e.target.checked
              )
            }
          />
          Enable background processing by default
        </label>
        <small className="text-muted">
          Automatically enable background processing for new configurations
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="processing-method">Default Processing Method</label>
        <select
          id="processing-method"
          value={settings.imageProcessing.defaultMethod}
          onChange={e =>
            handleImageProcessingSettingChange('defaultMethod', e.target.value)
          }
          className="form-control"
        >
          <option value="smart_detect">Smart Detection</option>
          <option value="ai_removal">AI Removal</option>
          <option value="color_replace">Color Replacement</option>
          <option value="edge_detection">Edge Detection</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="jpeg-quality">JPEG Quality</label>
        <div className="number-input-group">
          <input
            id="jpeg-quality"
            type="number"
            min="60"
            max="100"
            value={settings.imageProcessing.defaultQuality}
            onChange={e =>
              handleImageProcessingSettingChange(
                'defaultQuality',
                parseInt(e.target.value)
              )
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
            min="10"
            max="100"
            value={settings.imageProcessing.defaultEdgeThreshold}
            onChange={e =>
              handleImageProcessingSettingChange(
                'defaultEdgeThreshold',
                parseInt(e.target.value)
              )
            }
            className="form-control number-input"
          />
        </div>
      </div>
    </div>
  );
};
