/**
 * ConfigurationService - Centralized configuration management
 *
 * Following KISS principle: Simple configuration management
 * Following DRY principle: Single source for configuration logic
 * Following SOLID principle: Single responsibility - configuration management
 * Following YAGNI principle: Only what's currently used
 */

import { DownloadConfig, UserSettings } from '@/shared/types';
import { logger } from './LoggingService';
import { ValidationService } from './ValidationService';
import { IPCService } from './IPCService';

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ConfigurationState {
  downloadConfig: DownloadConfig | null;
  userSettings: UserSettings;
}

/**
 * Centralized service for managing application configuration
 * Handles both download configurations and user settings
 */
export class ConfigurationService {
  private static instance: ConfigurationService;
  private ipcService: IPCService;

  // Default user settings - centralized from SettingsTab
  private readonly defaultUserSettings: UserSettings = {
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
      updateChannel: 'stable',
      downloadUpdatesAutomatically: false,
    },
  };

  private constructor() {
    this.ipcService = IPCService.getInstance();
    logger.info('ConfigurationService initialized', 'ConfigurationService');
  }

  static getInstance(): ConfigurationService {
    if (!this.instance) {
      this.instance = new ConfigurationService();
    }
    return this.instance;
  }

  /**
   * Load user settings with safe defaults merging
   */
  async loadUserSettings(): Promise<UserSettings> {
    try {
      logger.debug('Loading user settings', 'ConfigurationService');
      const savedSettings = await this.ipcService.loadSettings();

      if (savedSettings) {
        // Deep merge with defaults to ensure all properties exist
        const mergedSettings = this.mergeUserSettings(savedSettings);
        logger.info(
          'User settings loaded successfully',
          'ConfigurationService',
          { hasCustomSettings: true }
        );
        return mergedSettings;
      } else {
        logger.info(
          'No saved settings found, using defaults',
          'ConfigurationService'
        );
        return this.defaultUserSettings;
      }
    } catch (error) {
      logger.error(
        'Error loading user settings',
        error instanceof Error ? error : new Error(String(error)),
        'ConfigurationService'
      );
      return this.defaultUserSettings;
    }
  }

  /**
   * Save user settings with validation
   */
  async saveUserSettings(
    settings: UserSettings
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.debug('Saving user settings', 'ConfigurationService');

      // Validate settings before saving
      const validation = this.validateUserSettings(settings);
      if (!validation.isValid) {
        const errorMessage = `Invalid settings: ${validation.errors.join(', ')}`;
        logger.error(errorMessage, undefined, 'ConfigurationService');
        return { success: false, message: errorMessage };
      }

      const result = await this.ipcService.saveSettings(settings);
      if (result.success) {
        logger.info('User settings saved successfully', 'ConfigurationService');
        return { success: true, message: 'Settings saved successfully' };
      } else {
        logger.error(
          'Error saving user settings',
          undefined,
          'ConfigurationService'
        );
        return {
          success: false,
          message: `Error saving settings: ${result.message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        'Error saving user settings',
        error instanceof Error ? error : new Error(errorMessage),
        'ConfigurationService'
      );
      return {
        success: false,
        message: `Error saving settings: ${errorMessage}`,
      };
    }
  }

  /**
   * Load download configuration
   */
  async loadDownloadConfig(): Promise<DownloadConfig | null> {
    try {
      logger.debug('Loading download configuration', 'ConfigurationService');
      const result = await this.ipcService.loadConfig();

      if (result && result.lastConfiguration) {
        logger.info(
          'Download configuration loaded successfully',
          'ConfigurationService'
        );
        return result.lastConfiguration;
      } else {
        logger.info('No saved configuration found', 'ConfigurationService');
        return null;
      }
    } catch (error) {
      logger.error(
        'Error loading download configuration',
        error instanceof Error ? error : new Error(String(error)),
        'ConfigurationService'
      );
      return null;
    }
  }

  /**
   * Save download configuration with validation
   */
  async saveDownloadConfig(
    config: DownloadConfig
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.debug('Saving download configuration', 'ConfigurationService');

      // Validate configuration before saving
      const validation = this.validateDownloadConfig(config);
      if (!validation.isValid) {
        const errorMessage = `Invalid configuration: ${validation.errors.join(', ')}`;
        logger.error(errorMessage, undefined, 'ConfigurationService');
        return { success: false, message: errorMessage };
      }

      const result = await this.ipcService.saveConfig(config);
      if (result.success) {
        logger.info(
          'Download configuration saved successfully',
          'ConfigurationService'
        );
        return { success: true, message: 'Configuration saved successfully' };
      } else {
        logger.error(
          'Error saving download configuration',
          undefined,
          'ConfigurationService'
        );
        return {
          success: false,
          message: `Error saving configuration: ${result.message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        'Error saving download configuration',
        error instanceof Error ? error : new Error(errorMessage),
        'ConfigurationService'
      );
      return {
        success: false,
        message: `Error saving configuration: ${errorMessage}`,
      };
    }
  }

  /**
   * Validate download configuration - delegates to ValidationService
   */
  validateDownloadConfig(
    config: DownloadConfig
  ): ConfigurationValidationResult {
    const result = ValidationService.validateDownloadConfig(config);

    if (result.isValid) {
      logger.validation('DownloadConfig', true);
    } else {
      logger.validation('DownloadConfig', false, result.errors.join(', '));
    }

    return { isValid: result.isValid, errors: result.errors };
  }

  /**
   * Validate user settings - delegates to ValidationService
   */
  validateUserSettings(settings: UserSettings): ConfigurationValidationResult {
    const result = ValidationService.validateUserSettings(settings);

    if (result.isValid) {
      logger.validation('UserSettings', true);
    } else {
      logger.validation('UserSettings', false, result.errors.join(', '));
    }

    return { isValid: result.isValid, errors: result.errors };
  }

  /**
   * Safely merge user settings with defaults - centralized from SettingsTab
   */
  mergeUserSettings(savedSettings: Partial<UserSettings>): UserSettings {
    return {
      ...this.defaultUserSettings,
      ...savedSettings,
      defaultPaths: {
        ...this.defaultUserSettings.defaultPaths,
        ...savedSettings.defaultPaths,
      },
      downloadBehavior: {
        ...this.defaultUserSettings.downloadBehavior,
        ...savedSettings.downloadBehavior,
      },
      imageProcessing: {
        ...this.defaultUserSettings.imageProcessing,
        ...savedSettings.imageProcessing,
      },
      uiPreferences: {
        ...this.defaultUserSettings.uiPreferences,
        ...savedSettings.uiPreferences,
      },
      updateSettings: {
        ...this.defaultUserSettings.updateSettings,
        ...savedSettings.updateSettings,
      },
    };
  }

  /**
   * Update specific user setting path safely
   */
  updateUserSetting(
    settings: UserSettings,
    path: string,
    value: any
  ): UserSettings {
    const newSettings = { ...settings };
    const pathParts = path.split('.');

    if (pathParts.length === 2) {
      const [section, key] = pathParts;
      if (section in newSettings) {
        (newSettings as any)[section] = {
          ...(newSettings as any)[section],
          [key]: value,
        };
      }
    }

    return newSettings;
  }

  /**
   * Update download configuration safely
   */
  updateDownloadConfig(
    config: DownloadConfig,
    updates: Partial<DownloadConfig>
  ): DownloadConfig {
    return {
      ...config,
      ...updates,
      // Handle nested objects safely
      backgroundProcessing: {
        ...config.backgroundProcessing,
        ...(updates.backgroundProcessing || {}),
      },
    };
  }

  /**
   * Get default user settings
   */
  getDefaultUserSettings(): UserSettings {
    return { ...this.defaultUserSettings };
  }

  /**
   * Reset user settings to defaults
   */
  async resetUserSettings(): Promise<{ success: boolean; message: string }> {
    logger.info('Resetting user settings to defaults', 'ConfigurationService');
    return this.saveUserSettings(this.defaultUserSettings);
  }
}

// Export singleton instance for convenience
export const configurationService = ConfigurationService.getInstance();
