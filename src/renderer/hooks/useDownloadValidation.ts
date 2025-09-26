import { useCallback } from 'react';
import { DownloadConfig } from '@/shared/types';
import { configurationService } from '@/services/ConfigurationService';
import { logger } from '@/services/LoggingService';

export const useDownloadValidation = (config: DownloadConfig) => {
  const validateDownloadConfig = useCallback((): string[] => {
    const validation = configurationService.validateDownloadConfig(config);

    if (!validation.isValid) {
      const errorMessage = validation.errors.join(', ');
      logger.error(
        'useDownloadValidation: Download configuration validation failed',
        new Error(errorMessage),
        'useDownloadValidation'
      );
      return validation.errors.map(error => `Error: ${error}`);
    }

    return [];
  }, [config]);

  return { validateDownloadConfig };
};
