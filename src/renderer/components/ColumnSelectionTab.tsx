import React from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import { configurationService } from '@/services/ConfigurationService';
import { logger } from '@/services/LoggingService';
import {
  useColumnSelectionState,
  useNetworkPathDefaults,
} from '@/renderer/hooks';
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
  const {
    config,
    error,
    setError,
    update,
    handleNext,
    setImageFilePath,
    setPdfFilePath,
  } = useColumnSelectionState({ data, initialConfig, onConfigurationComplete });
  const { imageFilePath, pdfFilePath } = config;
  const columnOptions = data.columns.map(value => ({ value, label: value }));

  useNetworkPathDefaults({
    imageFilePath,
    pdfFilePath,
    setImageFilePath,
    setPdfFilePath,
  });

  return (
    <div className="tab-panel">
      <h2>Column Selection & Configuration</h2>
      <p>
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
          onImageFilePathChange={setImageFilePath}
          pdfFilePath={pdfFilePath}
          onPdfFilePathChange={setPdfFilePath}
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
            const result =
              await configurationService.saveDownloadConfig(config);

            if (!result.success) {
              logger.error(
                'ColumnSelectionTab: Error saving configuration',
                new Error(result.message),
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
