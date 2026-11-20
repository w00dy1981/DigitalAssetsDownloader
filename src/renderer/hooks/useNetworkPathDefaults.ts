import { useEffect } from 'react';
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
        const settings = await window.electronAPI.loadSettings();
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
        await window.electronAPI.saveNetworkPaths({
          imageNetworkPath: imageFilePath,
          pdfNetworkPath: pdfFilePath,
        });
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
