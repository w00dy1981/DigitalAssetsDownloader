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
    state,
    columnOptions,
    setPartNoColumn,
    setImageColumns,
    setPdfColumn,
    setFilenameColumn,
    setImageFolder,
    setPdfFolder,
    setSourceImageFolder,
    setImageFilePath,
    setPdfFilePath,
    setError,
    error,
    currentConfig,
    handleNext,
  } = useColumnSelectionState({ data, initialConfig, onConfigurationComplete });

  const {
    partNoColumn,
    imageColumns,
    pdfColumn,
    filenameColumn,
    imageFolder,
    pdfFolder,
    sourceImageFolder,
    imageFilePath,
    pdfFilePath,
  } = state;

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
        Map your Excel columns to the appropriate data types and configure
        download settings.
      </p>
      <p className="data-info">
        <strong>Loaded Data:</strong> {data.sheetName} ({data.rows.length} rows,{' '}
        {data.columns.length} columns)
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="configuration-sections">
        <ColumnMappingPanel
          data={data}
          partNoColumn={partNoColumn}
          onPartNoColumnChange={setPartNoColumn}
          imageColumns={imageColumns}
          onImageColumnsChange={setImageColumns}
          pdfColumn={pdfColumn}
          onPdfColumnChange={setPdfColumn}
          filenameColumn={filenameColumn}
          onFilenameColumnChange={setFilenameColumn}
          columnOptions={columnOptions}
          onValidationError={setError}
        />

        <FolderConfigurationPanel
          imageFolder={imageFolder}
          onImageFolderChange={setImageFolder}
          pdfFolder={pdfFolder}
          onPdfFolderChange={setPdfFolder}
          sourceImageFolder={sourceImageFolder}
          onSourceImageFolderChange={setSourceImageFolder}
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
              await configurationService.saveDownloadConfig(currentConfig);

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
