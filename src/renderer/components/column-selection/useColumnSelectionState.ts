import { downloadConfigErrors } from '@/shared/downloadSettings';
import { useEffect, useState } from 'react';
import type { LoadedInput, DownloadConfig } from '@/shared/types';
import { defaultUserSettings } from '@/shared/userSettings';

export interface MappingFields {
  config: DownloadConfig;
  update<K extends keyof DownloadConfig>(
    key: K,
    value: DownloadConfig[K]
  ): void;
}

interface ColumnSelectionProps {
  data: LoadedInput;
  initialConfig: DownloadConfig | null;
  onConfigurationComplete: (config: DownloadConfig) => void;
}

export function useColumnSelectionState({
  data,
  initialConfig,
  onConfigurationComplete,
}: ColumnSelectionProps) {
  const [error, setError] = useState('');
  const [config, setConfig] = useState<DownloadConfig | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      const settings = await window.electronAPI
        .loadSettings()
        .catch(() => defaultUserSettings);
      if (!active) return;
      const paths = settings.defaultPaths;
      setConfig({
        partNoColumn: '',
        imageColumns: [],
        pdfColumn: '',
        filenameColumn: '',
        imageFolder: paths.imageDownloadFolder,
        pdfFolder: paths.pdfDownloadFolder,
        sourceImageFolder: paths.sourceImageFolder,
        imageFilePath: paths.imageNetworkPath,
        maxWorkers: settings.downloadBehavior.defaultConcurrentDownloads,
        ...initialConfig,
        backgroundProcessing: {
          enabled: settings.imageProcessing.enabledByDefault,
          quality: settings.imageProcessing.defaultQuality,
          ...initialConfig?.backgroundProcessing,
        },
        excelFile: data.filePath,
        sheetName: data.sheetName,
        sourceType: data.sourceType,
        sourceLabel: data.sourceLabel,
      });
    }
    void load();
    return () => {
      active = false;
    };
  }, [data, initialConfig]);

  function update<K extends keyof DownloadConfig>(
    key: K,
    value: DownloadConfig[K]
  ) {
    setConfig(previous => previous && { ...previous, [key]: value });
  }
  function handleNext() {
    if (!config) return;
    const errors = downloadConfigErrors(config);
    setError(errors.join(' '));
    if (!errors.length) onConfigurationComplete(config);
  }
  return {
    config,
    setError,
    error,
    update,
    handleNext,
  };
}
