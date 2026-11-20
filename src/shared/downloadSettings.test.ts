import { downloadConfigErrors, userSettingsErrors } from './downloadSettings';
import { defaultUserSettings } from './userSettings';
import type { DownloadOptions } from '@/download/downloadRun';

describe('download settings', () => {
  describe('validateDownloadConfig', () => {
    let validConfig: DownloadOptions;

    beforeEach(() => {
      validConfig = {
        partNoColumn: 'PartNumber',
        imageColumns: ['ImageURL1'],
        pdfColumn: 'PDFURL',
        filenameColumn: 'Filename',
        imageFolder: '/path/to/images',
        pdfFolder: '/path/to/pdfs',
        sourceImageFolder: '/path/to/source',
        imageFilePath: '/network/images',
        maxWorkers: 5,
        backgroundProcessing: {
          enabled: true,
          quality: 95,
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
      const config = {
        ...validConfig,
        imageColumns: [],
        pdfColumn: '',
        sourceImageFolder: '',
      };
      const result = downloadConfigErrors(config);
      expect(result).toContain(
        'Choose an image column, a source image folder or a PDF column'
      );
    });

    it('requires a whole worker count', () => {
      const config = { ...validConfig, maxWorkers: 2.5 };
      const result = downloadConfigErrors(config);
      expect(result).toContain('Max Workers must be a whole number');
    });

    it('validates JPEG quality even when white backgrounds are disabled', () => {
      const config = {
        ...validConfig,
        backgroundProcessing: {
          enabled: false,
          quality: 101,
        },
      };
      const result = downloadConfigErrors(config);
      expect(result).toContain('JPEG Quality must be no more than 100');
    });

    it('ignores JPEG quality for PDF-only downloads', () => {
      const config = {
        ...validConfig,
        imageColumns: [],
        backgroundProcessing: { enabled: true, quality: 101 },
      };
      expect(downloadConfigErrors(config)).toEqual([]);
    });
  });

  describe('validateUserSettings', () => {
    const validSettings = defaultUserSettings;

    it('should validate complete valid settings', () => {
      const result = userSettingsErrors(validSettings);
      expect(result).toEqual([]);
    });

    it('accepts supported download and encoder settings', () => {
      const settings = {
        ...validSettings,
        downloadBehavior: {
          ...validSettings.downloadBehavior,
          defaultConcurrentDownloads: 25,
          retryAttempts: 12,
          connectionTimeout: 60.5,
          readTimeout: 0,
        },
        imageProcessing: {
          ...validSettings.imageProcessing,
          defaultQuality: 50,
        },
      };
      const result = userSettingsErrors(settings);
      expect(result).toEqual([]);
    });

    it('should validate timeout values', () => {
      const settings = {
        ...validSettings,
        downloadBehavior: {
          ...validSettings.downloadBehavior,
          connectionTimeout: -1,
        },
      };
      const result = userSettingsErrors(settings);
      expect(result).toContain('Connection Timeout must be at least 0');
    });
  });
});
