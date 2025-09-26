import { useEffect } from 'react';
import { configurationService } from '@/services/ConfigurationService';
import { logger } from '@/services/LoggingService';

interface UseNetworkPathDefaultsParams {
  imageFilePath: string;
  pdfFilePath: string;
  setImageFilePath: (value: string) => void;
  setPdfFilePath: (value: string) => void;
}

export const useNetworkPathDefaults = ({
  imageFilePath,
  pdfFilePath,
  setImageFilePath,
  setPdfFilePath,
}: UseNetworkPathDefaultsParams) => {
  useEffect(() => {
    let isMounted = true;

    const loadSavedSettings = async () => {
      try {
        const settings = await configurationService.loadUserSettings();
        if (!isMounted) {
          return;
        }

        setImageFilePath(settings.defaultPaths.imageNetworkPath || '');
        setPdfFilePath(settings.defaultPaths.pdfNetworkPath || '');
      } catch (error) {
        logger.error(
          'useNetworkPathDefaults: Error loading settings',
          error instanceof Error ? error : new Error(String(error)),
          'useNetworkPathDefaults'
        );
        if (!isMounted) {
          return;
        }
        setImageFilePath('');
        setPdfFilePath('');
      }
    };

    loadSavedSettings();

    return () => {
      isMounted = false;
    };
  }, [setImageFilePath, setPdfFilePath]);

  useEffect(() => {
    if (!imageFilePath || !pdfFilePath) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const currentSettings = await configurationService.loadUserSettings();
        const updatedSettings = {
          ...currentSettings,
          defaultPaths: {
            ...currentSettings.defaultPaths,
            imageNetworkPath: imageFilePath,
            pdfNetworkPath: pdfFilePath,
          },
        };
        await configurationService.saveUserSettings(updatedSettings);
      } catch (error) {
        logger.error(
          'useNetworkPathDefaults: Error saving default network paths',
          error instanceof Error ? error : new Error(String(error)),
          'useNetworkPathDefaults'
        );
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [imageFilePath, pdfFilePath]);
};
