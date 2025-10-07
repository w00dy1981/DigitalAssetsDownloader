/**
 * Tests for AppConstantsService
 * Issue #23: Phase 6B - Configuration Enhancement
 */

import { AppConstantsService, appConstants } from './AppConstantsService';
import { CONSTANTS } from '@/shared/constants';
import { UserSettings } from '@/shared/types';

describe('AppConstantsService', () => {
  let service: AppConstantsService;

  beforeEach(() => {
    service = AppConstantsService.getInstance();
    // Clear any user settings to test defaults
    service.setUserSettings(undefined);
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = AppConstantsService.getInstance();
      const instance2 = AppConstantsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should export singleton instance', () => {
      expect(appConstants).toBeInstanceOf(AppConstantsService);
      expect(appConstants).toBe(AppConstantsService.getInstance());
    });
  });

  describe('Default Values', () => {
    test('should return default network timeouts', () => {
      const timeouts = service.getNetworkTimeouts();
      expect(timeouts).toEqual({
        connectionTimeout: CONSTANTS.NETWORK.CONNECTION_TIMEOUT,
        readTimeout: CONSTANTS.NETWORK.READ_TIMEOUT,
        updateCheckTimeout: CONSTANTS.NETWORK.UPDATE_CHECK_TIMEOUT,
        excelTimeout: CONSTANTS.NETWORK.EXCEL_TIMEOUT,
      });
    });

    test('should return default image processing values', () => {
      const imageConfig = service.getImageProcessing();
      expect(imageConfig).toEqual({
        defaultQuality: CONSTANTS.IMAGE.DEFAULT_QUALITY,
        defaultEdgeThreshold: CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
        minQuality: CONSTANTS.IMAGE.MIN_QUALITY,
        maxQuality: CONSTANTS.IMAGE.MAX_QUALITY,
      });
    });

    test('should return default UI configuration', () => {
      const uiConfig = service.getUIConfiguration();
      expect(uiConfig).toEqual({
        defaultWindowWidth: CONSTANTS.UI.DEFAULT_WINDOW_WIDTH,
        defaultWindowHeight: CONSTANTS.UI.DEFAULT_WINDOW_HEIGHT,
        minWindowWidth: CONSTANTS.UI.MIN_WINDOW_WIDTH,
        minWindowHeight: CONSTANTS.UI.MIN_WINDOW_HEIGHT,
        statusMessageDuration: CONSTANTS.UI.STATUS_MESSAGE_DURATION,
        devUpdateTimeout: CONSTANTS.UI.DEV_UPDATE_TIMEOUT,
        prodUpdateTimeout: CONSTANTS.UI.PROD_UPDATE_TIMEOUT,
      });
    });

    test('should return default download configuration', () => {
      const downloadConfig = service.getDownloadConfiguration();
      expect(downloadConfig).toEqual({
        minWorkers: CONSTANTS.DOWNLOAD.MIN_WORKERS,
        maxWorkers: CONSTANTS.DOWNLOAD.MAX_WORKERS,
        defaultWorkers: CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
        defaultRetryAttempts: CONSTANTS.DOWNLOAD.DEFAULT_RETRY_ATTEMPTS,
        maxRetryAttempts: CONSTANTS.DOWNLOAD.MAX_RETRY_ATTEMPTS,
      });
    });
  });

  describe('User Settings Overrides', () => {
    test('should use user settings for image quality override', () => {
      const userSettings: UserSettings = {
        defaultPaths: {
          lastFileDialogPath: '',
          imageDownloadFolder: '',
          pdfDownloadFolder: '',
          sourceImageFolder: '',
          imageNetworkPath: '',
          pdfNetworkPath: '',
        },
        downloadBehavior: {
          defaultConcurrentDownloads: 5,
          connectionTimeout: 5,
          readTimeout: 30,
          retryAttempts: 3,
        },
        imageProcessing: {
          enabledByDefault: true,
          defaultMethod: 'smart_detect',
          defaultQuality: 85, // Different from default
          defaultEdgeThreshold: 25, // Different from default
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

      service.setUserSettings(userSettings);
      const imageConfig = service.getImageProcessing();

      expect(imageConfig.defaultQuality).toBe(85);
      expect(imageConfig.defaultEdgeThreshold).toBe(25);
    });

    test('should use advanced settings overrides when available', () => {
      const userSettings: UserSettings = {
        defaultPaths: {
          lastFileDialogPath: '',
          imageDownloadFolder: '',
          pdfDownloadFolder: '',
          sourceImageFolder: '',
          imageNetworkPath: '',
          pdfNetworkPath: '',
        },
        downloadBehavior: {
          defaultConcurrentDownloads: 10,
          connectionTimeout: 8,
          readTimeout: 45,
          retryAttempts: 5,
        },
        imageProcessing: {
          enabledByDefault: true,
          defaultMethod: 'smart_detect',
          defaultQuality: 90,
          defaultEdgeThreshold: 35,
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
        advanced: {
          networkTimeouts: {
            connectionTimeout: 10000,
            readTimeout: 60000,
            updateCheckTimeout: 45000,
            excelTimeout: 40000,
          },
          windowSettings: {
            defaultWidth: 1400,
            defaultHeight: 900,
            statusMessageDuration: 10000,
          },
          imageDefaults: {
            qualityOverride: 75,
            edgeThresholdOverride: 40,
          },
        },
      };

      service.setUserSettings(userSettings);

      // Test network timeout overrides
      const timeouts = service.getNetworkTimeouts();
      expect(timeouts.connectionTimeout).toBe(10000);
      expect(timeouts.readTimeout).toBe(60000);
      expect(timeouts.updateCheckTimeout).toBe(45000);
      expect(timeouts.excelTimeout).toBe(40000);

      // Test UI configuration overrides
      const uiConfig = service.getUIConfiguration();
      expect(uiConfig.defaultWindowWidth).toBe(1400);
      expect(uiConfig.defaultWindowHeight).toBe(900);
      expect(uiConfig.statusMessageDuration).toBe(10000);

      // Test image processing overrides (advanced takes precedence)
      const imageConfig = service.getImageProcessing();
      expect(imageConfig.defaultQuality).toBe(75);
      expect(imageConfig.defaultEdgeThreshold).toBe(40);
    });

    test('should use download behavior settings', () => {
      const userSettings: UserSettings = {
        defaultPaths: {
          lastFileDialogPath: '',
          imageDownloadFolder: '',
          pdfDownloadFolder: '',
          sourceImageFolder: '',
          imageNetworkPath: '',
          pdfNetworkPath: '',
        },
        downloadBehavior: {
          defaultConcurrentDownloads: 8,
          connectionTimeout: 10,
          readTimeout: 60,
          retryAttempts: 5,
        },
        imageProcessing: {
          enabledByDefault: true,
          defaultMethod: 'smart_detect',
          defaultQuality: 90,
          defaultEdgeThreshold: 35,
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

      service.setUserSettings(userSettings);
      const downloadConfig = service.getDownloadConfiguration();

      expect(downloadConfig.defaultWorkers).toBe(8);
      expect(downloadConfig.defaultRetryAttempts).toBe(5);
    });
  });

  describe('Convenience Methods', () => {
    test('should return default timeout', () => {
      expect(service.getDefaultTimeout()).toBe(CONSTANTS.NETWORK.READ_TIMEOUT);
    });

    test('should return default quality', () => {
      expect(service.getDefaultQuality()).toBe(CONSTANTS.IMAGE.DEFAULT_QUALITY);
    });

    test('should detect development mode', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      expect(service.isDevelopment()).toBe(true);

      process.env.NODE_ENV = 'production';
      expect(service.isDevelopment()).toBe(false);

      // Restore original
      process.env.NODE_ENV = originalEnv;
    });

    test('should return environment-appropriate update timeout', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      expect(service.getUpdateTimeout()).toBe(CONSTANTS.UI.DEV_UPDATE_TIMEOUT);

      process.env.NODE_ENV = 'production';
      expect(service.getUpdateTimeout()).toBe(CONSTANTS.UI.PROD_UPDATE_TIMEOUT);

      // Restore original
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Constants Validation', () => {
    test('should have consistent constant values', () => {
      expect(CONSTANTS.IMAGE.DEFAULT_QUALITY).toBe(95);
      expect(CONSTANTS.NETWORK.READ_TIMEOUT).toBe(30000);
      expect(CONSTANTS.UI.DEFAULT_WINDOW_WIDTH).toBe(1200);
      expect(CONSTANTS.UI.DEFAULT_WINDOW_HEIGHT).toBe(800);
      expect(CONSTANTS.DOWNLOAD.DEFAULT_WORKERS).toBe(5);
    });

    test('should have valid quality ranges', () => {
      expect(CONSTANTS.IMAGE.MIN_QUALITY).toBeLessThan(
        CONSTANTS.IMAGE.MAX_QUALITY
      );
      expect(CONSTANTS.IMAGE.DEFAULT_QUALITY).toBeGreaterThanOrEqual(
        CONSTANTS.IMAGE.MIN_QUALITY
      );
      expect(CONSTANTS.IMAGE.DEFAULT_QUALITY).toBeLessThanOrEqual(
        CONSTANTS.IMAGE.MAX_QUALITY
      );
    });

    test('should have valid worker ranges', () => {
      expect(CONSTANTS.DOWNLOAD.MIN_WORKERS).toBeLessThan(
        CONSTANTS.DOWNLOAD.MAX_WORKERS
      );
      expect(CONSTANTS.DOWNLOAD.DEFAULT_WORKERS).toBeGreaterThanOrEqual(
        CONSTANTS.DOWNLOAD.MIN_WORKERS
      );
      expect(CONSTANTS.DOWNLOAD.DEFAULT_WORKERS).toBeLessThanOrEqual(
        CONSTANTS.DOWNLOAD.MAX_WORKERS
      );
    });
  });
});
