import { ValidationService } from './ValidationService';
import { DownloadConfig, UserSettings } from '@/shared/types';

describe('ValidationService', () => {
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
      const result = ValidationService.validateDownloadConfig(validConfig);
      expect(result.isValid).toBe(true);
    });

    it('should require part number column', () => {
      const config = { ...validConfig, partNoColumn: '' };
      const result = ValidationService.validateDownloadConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Part Number Column is required');
    });

    it('should require at least one download type', () => {
      const config = { ...validConfig, imageColumns: [], pdfColumn: '' };
      const result = ValidationService.validateDownloadConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'At least one Image URL column or PDF column is required'
      );
    });

    it('should validate worker count range', () => {
      const config = { ...validConfig, maxWorkers: 25 };
      const result = ValidationService.validateDownloadConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max Workers must be no more than 20');
    });

    it('should validate background processing settings', () => {
      const config = {
        ...validConfig,
        backgroundProcessing: {
          ...validConfig.backgroundProcessing,
          quality: 50,
        },
      };
      const result = ValidationService.validateDownloadConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('JPEG Quality must be at least 60');
    });
  });

  describe('validateUserSettings', () => {
    let validSettings: UserSettings;

    beforeEach(() => {
      validSettings = {
        defaultPaths: {
          lastFileDialogPath: '/home/user',
          imageDownloadFolder: '/home/user/images',
          pdfDownloadFolder: '/home/user/pdfs',
          sourceImageFolder: '/home/user/source',
          imageNetworkPath: '/network/images',
          pdfNetworkPath: '/network/pdfs',
        },
        downloadBehavior: {
          defaultConcurrentDownloads: 5,
          connectionTimeout: 10,
          readTimeout: 30,
          retryAttempts: 3,
        },
        imageProcessing: {
          enabledByDefault: true,
          defaultMethod: 'smart_detect',
          defaultQuality: 95,
          defaultEdgeThreshold: 30,
        },
        uiPreferences: {
          rememberFileDialogPath: true,
          showAdvancedOptions: false,
          startupTab: 'file',
        },
        updateSettings: {
          enableAutoUpdates: true,
          checkForUpdatesOnStartup: true,
          downloadUpdatesAutomatically: false,
        },
      };
    });

    it('should validate complete valid settings', () => {
      const result = ValidationService.validateUserSettings(validSettings);
      expect(result.isValid).toBe(true);
    });

    it('should validate concurrent downloads range', () => {
      const settings = {
        ...validSettings,
        downloadBehavior: {
          ...validSettings.downloadBehavior,
          defaultConcurrentDownloads: 25,
        },
      };
      const result = ValidationService.validateUserSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Concurrent Downloads must be no more than 20'
      );
    });

    it('should validate timeout values', () => {
      const settings = {
        ...validSettings,
        downloadBehavior: {
          ...validSettings.downloadBehavior,
          connectionTimeout: 0,
        },
      };
      const result = ValidationService.validateUserSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Connection Timeout must be at least 1');
    });

    it('should add warnings for invalid paths without failing', () => {
      const result = ValidationService.validateUserSettings({
        ...validSettings,
        defaultPaths: {
          ...validSettings.defaultPaths,
          imageDownloadFolder: '../invalid',
        },
      });
      expect(result.isValid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Utility Method Tests
  // ========================================
});
