/**
 * ConfigurationService Tests
 *
 * Testing the centralized configuration management service
 */

import { ConfigurationService } from './ConfigurationService';
import { UserSettings, DownloadConfig } from '@/shared/types';
import { ValidationService } from './ValidationService';
import { IPCService } from './IPCService';

// Mock window object (required for some services but not used directly here)
Object.defineProperty(global, 'window', {
  value: {},
  writable: true,
});

// Mock LoggingService to prevent console noise in tests
jest.mock('./LoggingService', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    validation: jest.fn(),
  },
}));

// Mock ValidationService
jest.mock('./ValidationService', () => ({
  ValidationService: {
    validateDownloadConfig: jest.fn(),
    validateUserSettings: jest.fn(),
  },
}));

// Mock IPCService
jest.mock('./IPCService', () => ({
  IPCService: {
    getInstance: jest.fn(() => ({
      loadSettings: jest.fn(),
      saveSettings: jest.fn(),
      loadConfig: jest.fn(),
      saveConfig: jest.fn(),
    })),
  },
}));

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let mockIPCService: jest.Mocked<IPCService>;
  const mockValidationService = ValidationService as jest.Mocked<
    typeof ValidationService
  >;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a fresh mock IPC service for each test
    mockIPCService = {
      loadSettings: jest.fn(),
      saveSettings: jest.fn(),
      loadConfig: jest.fn(),
      saveConfig: jest.fn(),
    } as any;

    // Mock the getInstance call to return our mock
    (IPCService.getInstance as jest.Mock).mockReturnValue(mockIPCService);

    // Reset the singleton instance for testing
    (ConfigurationService as any).instance = undefined;

    // Get fresh instance for each test
    service = ConfigurationService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigurationService.getInstance();
      const instance2 = ConfigurationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('User Settings Management', () => {
    describe('loadUserSettings', () => {
      it('should return default settings when no saved settings exist', async () => {
        mockIPCService.loadSettings.mockResolvedValue(null);

        const result = await service.loadUserSettings();

        expect(result).toEqual(service.getDefaultUserSettings());
        expect(mockIPCService.loadSettings).toHaveBeenCalledTimes(1);
      });

      it('should merge saved settings with defaults', async () => {
        const partialSettings = {
          downloadBehavior: {
            defaultConcurrentDownloads: 10,
          },
        };
        mockIPCService.loadSettings.mockResolvedValue(partialSettings);

        const result = await service.loadUserSettings();

        expect(result.downloadBehavior.defaultConcurrentDownloads).toBe(10);
        expect(result.downloadBehavior.connectionTimeout).toBe(5); // default value
        expect(result.defaultPaths).toBeDefined(); // should have all default paths
      });

      it('should return defaults when loading fails', async () => {
        mockIPCService.loadSettings.mockRejectedValue(new Error('Load failed'));

        const result = await service.loadUserSettings();

        expect(result).toEqual(service.getDefaultUserSettings());
      });
    });

    describe('saveUserSettings', () => {
      const validSettings: UserSettings = {
        defaultPaths: {
          lastFileDialogPath: '/test/path',
          imageDownloadFolder: '/test/images',
          pdfDownloadFolder: '/test/pdfs',
          sourceImageFolder: '/test/source',
          imageNetworkPath: '\\\\server\\images',
          pdfNetworkPath: '\\\\server\\pdfs',
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
          defaultQuality: 85,
          defaultEdgeThreshold: 50,
        },
        uiPreferences: {
          rememberFileDialogPath: true,
          showAdvancedOptions: false,
          startupTab: 'file',
        },
        updateSettings: {
          enableAutoUpdates: true,
          checkForUpdatesOnStartup: true,
          updateChannel: 'stable',
          downloadUpdatesAutomatically: false,
        },
      };

      it('should save valid settings successfully', async () => {
        mockIPCService.saveSettings.mockResolvedValue({
          success: true,
          message: 'Settings saved',
        });
        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await service.saveUserSettings(validSettings);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Settings saved successfully');
        expect(mockIPCService.saveSettings).toHaveBeenCalledWith(validSettings);
      });

      it('should reject invalid settings', async () => {
        const invalidSettings = {
          ...validSettings,
          downloadBehavior: {
            ...validSettings.downloadBehavior,
            defaultConcurrentDownloads: 25, // Invalid: > 20
          },
        };

        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: false,
          errors: ['Default concurrent downloads must be between 1 and 20'],
        });

        const result = await service.saveUserSettings(invalidSettings);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid settings');
        expect(mockIPCService.saveSettings).not.toHaveBeenCalled();
      });

      it('should handle save errors', async () => {
        mockIPCService.saveSettings.mockRejectedValue(new Error('Save failed'));
        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await service.saveUserSettings(validSettings);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Error saving settings');
      });
    });

    describe('validateUserSettings', () => {
      it('should validate correct settings', () => {
        const baseValidSettings: UserSettings =
          service.getDefaultUserSettings();
        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = service.validateUserSettings(baseValidSettings);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(mockValidationService.validateUserSettings).toHaveBeenCalledWith(
          baseValidSettings
        );
      });

      it('should reject invalid concurrent downloads', () => {
        const baseValidSettings: UserSettings =
          service.getDefaultUserSettings();
        const invalidSettings = {
          ...baseValidSettings,
          downloadBehavior: {
            ...baseValidSettings.downloadBehavior,
            defaultConcurrentDownloads: 25,
          },
        };

        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: false,
          errors: ['Default concurrent downloads must be between 1 and 20'],
        });

        const result = service.validateUserSettings(invalidSettings);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Default concurrent downloads must be between 1 and 20'
        );
        expect(mockValidationService.validateUserSettings).toHaveBeenCalledWith(
          invalidSettings
        );
      });

      it('should reject invalid JPEG quality', () => {
        const baseValidSettings: UserSettings =
          service.getDefaultUserSettings();
        const invalidSettings = {
          ...baseValidSettings,
          imageProcessing: {
            ...baseValidSettings.imageProcessing,
            defaultQuality: 50,
          },
        };

        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: false,
          errors: ['Default JPEG quality must be between 60% and 100%'],
        });

        const result = service.validateUserSettings(invalidSettings);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Default JPEG quality must be between 60% and 100%'
        );
        expect(mockValidationService.validateUserSettings).toHaveBeenCalledWith(
          invalidSettings
        );
      });

      it('should reject invalid startup tab', () => {
        const baseValidSettings: UserSettings =
          service.getDefaultUserSettings();
        const invalidSettings = {
          ...baseValidSettings,
          uiPreferences: {
            ...baseValidSettings.uiPreferences,
            startupTab: 'invalid' as any,
          },
        };

        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: false,
          errors: ['Invalid startup tab selection'],
        });

        const result = service.validateUserSettings(invalidSettings);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid startup tab selection');
        expect(mockValidationService.validateUserSettings).toHaveBeenCalledWith(
          invalidSettings
        );
      });
    });

    describe('updateUserSetting', () => {
      it('should update nested setting correctly', () => {
        const settings = service.getDefaultUserSettings();
        const updated = service.updateUserSetting(
          settings,
          'downloadBehavior.defaultConcurrentDownloads',
          10
        );

        expect(updated.downloadBehavior.defaultConcurrentDownloads).toBe(10);
        expect(updated.downloadBehavior.connectionTimeout).toBe(
          settings.downloadBehavior.connectionTimeout
        );
      });

      it('should not modify original settings', () => {
        const settings = service.getDefaultUserSettings();
        const originalValue =
          settings.downloadBehavior.defaultConcurrentDownloads;

        service.updateUserSetting(
          settings,
          'downloadBehavior.defaultConcurrentDownloads',
          10
        );

        expect(settings.downloadBehavior.defaultConcurrentDownloads).toBe(
          originalValue
        );
      });
    });

    describe('resetUserSettings', () => {
      it('should reset to default settings', async () => {
        mockIPCService.saveSettings.mockResolvedValue({
          success: true,
          message: 'Reset successful',
        });
        mockValidationService.validateUserSettings.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await service.resetUserSettings();

        expect(result.success).toBe(true);
        expect(mockIPCService.saveSettings).toHaveBeenCalledWith(
          service.getDefaultUserSettings()
        );
      });
    });
  });

  describe('Download Configuration Management', () => {
    describe('validateDownloadConfig', () => {
      const baseValidConfig: DownloadConfig = {
        excelFile: '/test/file.xlsx',
        sheetName: 'Sheet1',
        partNoColumn: 'Part Number',
        imageColumns: ['Image URL 1'],
        pdfColumn: 'PDF URL',
        filenameColumn: 'Filename',
        imageFolder: '/test/images',
        pdfFolder: '/test/pdfs',
        sourceImageFolder: '/test/source',
        imageFilePath: '\\\\server\\images',
        pdfFilePath: '\\\\server\\pdfs',
        maxWorkers: 5,
        backgroundProcessing: {
          enabled: true,
          method: 'smart_detect',
          quality: 95,
          edgeThreshold: 30,
        },
      };

      it('should validate correct configuration', () => {
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = service.validateDownloadConfig(baseValidConfig);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(
          mockValidationService.validateDownloadConfig
        ).toHaveBeenCalledWith(baseValidConfig);
      });

      it('should require part number column', () => {
        const invalidConfig = { ...baseValidConfig, partNoColumn: '' };
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: false,
          errors: ['Part Number column is required'],
        });

        const result = service.validateDownloadConfig(invalidConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Part Number column is required');
        expect(
          mockValidationService.validateDownloadConfig
        ).toHaveBeenCalledWith(invalidConfig);
      });

      it('should require at least one URL column', () => {
        const invalidConfig = {
          ...baseValidConfig,
          imageColumns: [],
          pdfColumn: '',
        };
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: false,
          errors: ['At least one Image URL column or PDF column is required'],
        });

        const result = service.validateDownloadConfig(invalidConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'At least one Image URL column or PDF column is required'
        );
        expect(
          mockValidationService.validateDownloadConfig
        ).toHaveBeenCalledWith(invalidConfig);
      });

      it('should require image folder when image columns selected', () => {
        const invalidConfig = {
          ...baseValidConfig,
          imageFolder: '',
          imageColumns: ['Image URL 1'],
        };
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: false,
          errors: [
            'Image download folder is required when image columns are selected',
          ],
        });

        const result = service.validateDownloadConfig(invalidConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Image download folder is required when image columns are selected'
        );
        expect(
          mockValidationService.validateDownloadConfig
        ).toHaveBeenCalledWith(invalidConfig);
      });

      it('should validate worker count range', () => {
        const invalidConfig = { ...baseValidConfig, maxWorkers: 25 };
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: false,
          errors: ['Concurrent downloads must be between 1 and 20'],
        });

        const result = service.validateDownloadConfig(invalidConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Concurrent downloads must be between 1 and 20'
        );
        expect(
          mockValidationService.validateDownloadConfig
        ).toHaveBeenCalledWith(invalidConfig);
      });

      it('should validate background processing quality', () => {
        const invalidConfig = {
          ...baseValidConfig,
          backgroundProcessing: {
            ...baseValidConfig.backgroundProcessing,
            quality: 50,
          },
        };
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: false,
          errors: ['JPEG quality must be between 60% and 100%'],
        });

        const result = service.validateDownloadConfig(invalidConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'JPEG quality must be between 60% and 100%'
        );
        expect(
          mockValidationService.validateDownloadConfig
        ).toHaveBeenCalledWith(invalidConfig);
      });
    });

    describe('updateDownloadConfig', () => {
      it('should update configuration safely', () => {
        const baseConfig: DownloadConfig = {
          excelFile: '/test/file.xlsx',
          sheetName: 'Sheet1',
          partNoColumn: 'Part Number',
          imageColumns: ['Image URL 1'],
          pdfColumn: 'PDF URL',
          filenameColumn: 'Filename',
          imageFolder: '/test/images',
          pdfFolder: '/test/pdfs',
          sourceImageFolder: '/test/source',
          imageFilePath: '\\\\server\\images',
          pdfFilePath: '\\\\server\\pdfs',
          maxWorkers: 5,
          backgroundProcessing: {
            enabled: true,
            method: 'smart_detect',
            quality: 95,
            edgeThreshold: 30,
          },
        };

        const updates = {
          maxWorkers: 10,
          backgroundProcessing: {
            quality: 85,
          },
        };

        const result = service.updateDownloadConfig(baseConfig, updates);

        expect(result.maxWorkers).toBe(10);
        expect(result.backgroundProcessing.quality).toBe(85);
        expect(result.backgroundProcessing.method).toBe('smart_detect'); // should preserve existing
        expect(result.backgroundProcessing.enabled).toBe(true); // should preserve existing
      });
    });

    describe('loadDownloadConfig', () => {
      it('should load existing configuration', async () => {
        const mockConfig = { partNoColumn: 'Part Number' };
        mockIPCService.loadConfig.mockResolvedValue({
          lastConfiguration: mockConfig,
          recentFiles: [],
          windowState: { width: 800, height: 600, isMaximized: false },
        });

        const result = await service.loadDownloadConfig();

        expect(result).toEqual(mockConfig);
        expect(mockIPCService.loadConfig).toHaveBeenCalledTimes(1);
      });

      it('should return null when no configuration exists', async () => {
        mockIPCService.loadConfig.mockResolvedValue(null);

        const result = await service.loadDownloadConfig();

        expect(result).toBeNull();
      });

      it('should handle load errors', async () => {
        mockIPCService.loadConfig.mockRejectedValue(new Error('Load failed'));

        const result = await service.loadDownloadConfig();

        expect(result).toBeNull();
      });
    });

    describe('saveDownloadConfig', () => {
      const validConfig: DownloadConfig = {
        excelFile: '/test/file.xlsx',
        sheetName: 'Sheet1',
        partNoColumn: 'Part Number',
        imageColumns: ['Image URL 1'],
        pdfColumn: 'PDF URL',
        filenameColumn: 'Filename',
        imageFolder: '/test/images',
        pdfFolder: '/test/pdfs',
        sourceImageFolder: '/test/source',
        imageFilePath: '\\\\server\\images',
        pdfFilePath: '\\\\server\\pdfs',
        maxWorkers: 5,
        backgroundProcessing: {
          enabled: true,
          method: 'smart_detect',
          quality: 95,
          edgeThreshold: 30,
        },
      };

      it('should save valid configuration', async () => {
        mockIPCService.saveConfig.mockResolvedValue({
          success: true,
          message: 'Config saved',
        });
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await service.saveDownloadConfig(validConfig);

        expect(result.success).toBe(true);
        expect(result.message).toBe('Configuration saved successfully');
        expect(mockIPCService.saveConfig).toHaveBeenCalledWith(validConfig);
      });

      it('should reject invalid configuration', async () => {
        const invalidConfig = { ...validConfig, partNoColumn: '' };
        mockValidationService.validateDownloadConfig.mockReturnValue({
          isValid: false,
          errors: ['Part Number column is required'],
        });

        const result = await service.saveDownloadConfig(invalidConfig);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid configuration');
        expect(mockIPCService.saveConfig).not.toHaveBeenCalled();
      });
    });
  });
});
