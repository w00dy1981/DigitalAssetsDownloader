import { useCallback, useState } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import { CONSTANTS } from '@/shared/constants';
import { ValidationService } from '@/services/ValidationService';

interface ColumnSelectionProps {
  data: SpreadsheetData;
  initialConfig: DownloadConfig | null;
  onConfigurationComplete: (config: DownloadConfig) => void;
}

export function useColumnSelectionState({
  data,
  initialConfig,
  onConfigurationComplete,
}: ColumnSelectionProps) {
  const [error, setError] = useState('');
  const [config, setConfig] = useState<DownloadConfig>(() => ({
    partNoColumn: '',
    imageColumns: [],
    pdfColumn: '',
    filenameColumn: '',
    imageFolder: '',
    pdfFolder: '',
    sourceImageFolder: '',
    imageFilePath: '',
    pdfFilePath: '',
    maxWorkers: CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
    ...initialConfig,
    backgroundProcessing: {
      enabled: true,
      method: 'smart_detect',
      quality: CONSTANTS.IMAGE.DEFAULT_QUALITY,
      edgeThreshold: CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
      ...initialConfig?.backgroundProcessing,
    },
    excelFile: data.filePath,
    sheetName: data.sheetName,
    sourceType: data.sourceType ?? 'file',
    sourceLabel: data.sourceLabel ?? data.filePath,
  }));
  const update = useCallback(
    <K extends keyof DownloadConfig>(key: K, value: DownloadConfig[K]) => {
      setConfig(previous => ({ ...previous, [key]: value }));
    },
    []
  );
  const setImageFilePath = useCallback(
    (value: string) => update('imageFilePath', value),
    [update]
  );
  const setPdfFilePath = useCallback(
    (value: string) => update('pdfFilePath', value),
    [update]
  );

  function handleNext() {
    const { errors } = ValidationService.validateDownloadConfig(config);
    setError(errors.join(' '));
    if (!errors.length) onConfigurationComplete(config);
  }
  return {
    config,
    setError,
    error,
    update,
    handleNext,
    setImageFilePath,
    setPdfFilePath,
  };
}
