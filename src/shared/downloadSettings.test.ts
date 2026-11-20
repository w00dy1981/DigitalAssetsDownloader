import { downloadConfigErrors, userSettingsErrors } from './downloadSettings';
import { defaultUserSettings } from './userSettings';
import { DownloadConfig } from '@/shared/types';

describe('download settings', () => {
  describe('validateDownloadConfig', () => {
    let validConfig: DownloadConfig;

    beforeEach(() => {
      validConfig = {
        excelFile: '/path/to/file.xlsx',
        sheetName: 'Sheet1',
        partNoColumn: 'PartNumber',
        imageColumns: ['ImageURL1'],
        pdfColumn: 'PDFURL',
        filenameColumn: 'Filename',
        imageFolder: '/path/to/images',
        pdfFolder: '/path/to/pdfs',
        sourceImageFolder: '/path/to/source',
        imageFilePath: '/network/images',
        pdfFilePath: '/network/pdfs',
        maxWorkers: 5,
        backgroundProcessing: {
          enabled: true,
          method: 'smart_detect',
          quality: 95,
          edgeThreshold: 30,
        },
      };
    });

    it('should validate complete valid configuration', () => {
      const result = downloadConfigErrors(validConfig);
      expect(result).toEqual([]);
    });

    it('should require part number column', () => {
      const config = { ...validConfig, partNoColumn: '' };
      const result = downloadConfigErrors(config);
      expect(result).toContain('Part Number Column is required');
    });

    it('should require at least one download type', () => {
      const config = { ...validConfig, imageColumns: [], pdfColumn: '' };
      const result = downloadConfigErrors(config);
      expect(result).toContain(
        'At least one Image URL column or PDF column is required'
      );
    });

    it('should validate worker count range', () => {
      const config = { ...validConfig, maxWorkers: 25 };
      const result = downloadConfigErrors(config);
      expect(result).toContain('Max Workers must be no more than 20');
    });

    it('should validate background processing settings', () => {
      const config = {
        ...validConfig,
        backgroundProcessing: {
          ...validConfig.backgroundProcessing,
          quality: 50,
        },
      };
      const result = downloadConfigErrors(config);
      expect(result).toContain('JPEG Quality must be at least 60');
    });
  });

  describe('validateUserSettings', () => {
    const validSettings = defaultUserSettings;

    it('should validate complete valid settings', () => {
      const result = userSettingsErrors(validSettings);
      expect(result).toEqual([]);
    });

    it('should validate concurrent downloads range', () => {
      const settings = {
        ...validSettings,
        downloadBehavior: {
          ...validSettings.downloadBehavior,
          defaultConcurrentDownloads: 25,
        },
      };
      const result = userSettingsErrors(settings);
      expect(result).toContain('Concurrent Downloads must be no more than 20');
    });

    it('should validate timeout values', () => {
      const settings = {
        ...validSettings,
        downloadBehavior: {
          ...validSettings.downloadBehavior,
          connectionTimeout: 0,
        },
      };
      const result = userSettingsErrors(settings);
      expect(result).toContain('Connection Timeout must be at least 1');
    });
  });
});
