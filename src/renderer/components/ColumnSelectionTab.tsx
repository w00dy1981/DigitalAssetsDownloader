import React from 'react';
import type { LoadedInput, DownloadConfig } from '@/shared/types';
import { useColumnSelectionState } from './column-selection/useColumnSelectionState';
import {
  ColumnMappingPanel,
  FolderConfigurationPanel,
} from './column-selection';

interface ColumnSelectionTabProps {
  data: LoadedInput;
  onConfigurationComplete: (config: DownloadConfig) => void;
  initialConfig: DownloadConfig | null;
}

const ColumnSelectionTab: React.FC<ColumnSelectionTabProps> = ({
  data,
  onConfigurationComplete,
  initialConfig,
}) => {
  const { config, error, setError, update, handleNext } =
    useColumnSelectionState({ data, initialConfig, onConfigurationComplete });
  if (!config) return <p>Loading column settings...</p>;

  return (
    <div className="column-selection-tab">
      <h2 className="screen-title">Column Selection & Configuration</h2>
      <p className="mapping-intro">
        Map your input columns to the appropriate data types and configure
        download settings.
      </p>
      <p className="data-info">
        <strong>Loaded Data:</strong> {data.sheetName} ({data.rowCount} rows,{' '}
        {data.columns.length} columns)
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="configuration-sections">
        <ColumnMappingPanel
          config={config}
          update={update}
          columns={data.columns}
        />
        <FolderConfigurationPanel
          config={config}
          update={update}
          onError={setError}
        />
      </div>

      <div className="btn-group mt-4">
        <button type="button" className="btn btn-success" onClick={handleNext}>
          Next: Process & Download →
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            try {
              await window.electronAPI.saveConfig(config);
            } catch (error) {
              console.error(
                'ColumnSelectionTab: Error saving configuration',
                error instanceof Error ? error : new Error(String(error))
              );
            }
          }}
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};

export default ColumnSelectionTab;
