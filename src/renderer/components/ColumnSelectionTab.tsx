import React from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import { logger } from '@/services/LoggingService';
import { useColumnSelectionState } from '@/renderer/hooks';
import {
  ColumnMappingPanel,
  FolderConfigurationPanel,
  NetworkPathsPanel,
} from './column-selection';

interface ColumnSelectionTabProps {
  data: SpreadsheetData;
  onConfigurationComplete: (config: DownloadConfig) => void;
  initialConfig: DownloadConfig | null;
}

const ColumnSelectionTab: React.FC<ColumnSelectionTabProps> = ({
  data,
  onConfigurationComplete,
  initialConfig,
}) => {
  const { config, error, setError, update, handleNext, changeNetworkPath } =
    useColumnSelectionState({ data, initialConfig, onConfigurationComplete });
  if (!config) return <p>Loading column settings...</p>;
  const { imageFilePath, pdfFilePath } = config;
  const columnOptions = data.columns.map(value => ({ value, label: value }));

  return (
    <div className="column-selection-tab">
      <h2 className="screen-title">Column Selection & Configuration</h2>
      <p className="mapping-intro">
        Map your input columns to the appropriate data types and configure
        download settings.
      </p>
      <p className="data-info">
        <strong>Loaded Data:</strong> {data.sheetName} ({data.rows.length} rows,{' '}
        {data.columns.length} columns)
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="configuration-sections">
        <ColumnMappingPanel
          partNoColumn={config.partNoColumn}
          onPartNoColumnChange={value => update('partNoColumn', value)}
          imageColumns={config.imageColumns}
          onImageColumnsChange={value => update('imageColumns', value)}
          pdfColumn={config.pdfColumn}
          onPdfColumnChange={value => update('pdfColumn', value)}
          filenameColumn={config.filenameColumn}
          onFilenameColumnChange={value => update('filenameColumn', value)}
          columnOptions={columnOptions}
        />

        <FolderConfigurationPanel
          imageFolder={config.imageFolder}
          onImageFolderChange={value => update('imageFolder', value)}
          pdfFolder={config.pdfFolder}
          onPdfFolderChange={value => update('pdfFolder', value)}
          sourceImageFolder={config.sourceImageFolder}
          onSourceImageFolderChange={value =>
            update('sourceImageFolder', value)
          }
          onError={setError}
        />

        <NetworkPathsPanel
          imageFilePath={imageFilePath}
          onImageFilePathChange={value =>
            changeNetworkPath('imageFilePath', value)
          }
          pdfFilePath={pdfFilePath}
          onPdfFilePathChange={value => changeNetworkPath('pdfFilePath', value)}
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
              logger.error(
                'ColumnSelectionTab: Error saving configuration',
                error instanceof Error ? error : new Error(String(error)),
                'ColumnSelectionTab'
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
