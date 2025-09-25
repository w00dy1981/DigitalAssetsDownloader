/**
 * AppConstantsService - Centralized access to application constants
 * Issue #23: Phase 6B - Configuration Enhancement
 * 
 * Provides type-safe access to configuration values with user setting overrides
 * and fallbacks to application constants.
 */

import { CONSTANTS } from '@/shared/constants';
import { UserSettings } from '@/shared/types';

export class AppConstantsService {
  private static instance: AppConstantsService;
  private userSettings?: UserSettings;

  private constructor() {}

  static getInstance(): AppConstantsService {
    if (!this.instance) {
      this.instance = new AppConstantsService();
    }
    return this.instance;
  }

  /**
   * Update user settings for configuration overrides
   */
  setUserSettings(settings?: UserSettings): void {
    this.userSettings = settings;
  }

  /**
   * Get network timeout values with user overrides
   */
  getNetworkTimeouts() {
    const advanced = this.userSettings?.advanced?.networkTimeouts;
    return {
      connectionTimeout: advanced?.connectionTimeout ?? CONSTANTS.NETWORK.CONNECTION_TIMEOUT,
      readTimeout: advanced?.readTimeout ?? CONSTANTS.NETWORK.READ_TIMEOUT,
      updateCheckTimeout: advanced?.updateCheckTimeout ?? CONSTANTS.NETWORK.UPDATE_CHECK_TIMEOUT,
      excelTimeout: advanced?.excelTimeout ?? CONSTANTS.NETWORK.EXCEL_TIMEOUT,
    };
  }

  /**
   * Get image processing values with user overrides
   */
  getImageProcessing() {
    const advanced = this.userSettings?.advanced?.imageDefaults;
    const userDefaults = this.userSettings?.imageProcessing;
    
    return {
      defaultQuality: advanced?.qualityOverride ?? 
                      userDefaults?.defaultQuality ?? 
                      CONSTANTS.IMAGE.DEFAULT_QUALITY,
      defaultEdgeThreshold: advanced?.edgeThresholdOverride ?? 
                           userDefaults?.defaultEdgeThreshold ?? 
                           CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
      minQuality: CONSTANTS.IMAGE.MIN_QUALITY,
      maxQuality: CONSTANTS.IMAGE.MAX_QUALITY,
    };
  }

  /**
   * Get UI configuration values with user overrides
   */
  getUIConfiguration() {
    const advanced = this.userSettings?.advanced?.windowSettings;
    return {
      defaultWindowWidth: advanced?.defaultWidth ?? CONSTANTS.UI.DEFAULT_WINDOW_WIDTH,
      defaultWindowHeight: advanced?.defaultHeight ?? CONSTANTS.UI.DEFAULT_WINDOW_HEIGHT,
      minWindowWidth: CONSTANTS.UI.MIN_WINDOW_WIDTH,
      minWindowHeight: CONSTANTS.UI.MIN_WINDOW_HEIGHT,
      statusMessageDuration: advanced?.statusMessageDuration ?? CONSTANTS.UI.STATUS_MESSAGE_DURATION,
      devUpdateTimeout: CONSTANTS.UI.DEV_UPDATE_TIMEOUT,
      prodUpdateTimeout: CONSTANTS.UI.PROD_UPDATE_TIMEOUT,
    };
  }

  /**
   * Get download configuration values
   */
  getDownloadConfiguration() {
    const userDefaults = this.userSettings?.downloadBehavior;
    return {
      minWorkers: CONSTANTS.DOWNLOAD.MIN_WORKERS,
      maxWorkers: CONSTANTS.DOWNLOAD.MAX_WORKERS,
      defaultWorkers: userDefaults?.defaultConcurrentDownloads ?? CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
      defaultRetryAttempts: userDefaults?.retryAttempts ?? CONSTANTS.DOWNLOAD.DEFAULT_RETRY_ATTEMPTS,
      maxRetryAttempts: CONSTANTS.DOWNLOAD.MAX_RETRY_ATTEMPTS,
    };
  }

  /**
   * Get file and path configuration values
   */
  getPathConfiguration() {
    return {
      logFileMaxSize: CONSTANTS.PATH.LOG_FILE_MAX_SIZE,
    };
  }

  /**
   * Convenience method to get commonly used timeout value
   */
  getDefaultTimeout(): number {
    return this.getNetworkTimeouts().readTimeout;
  }

  /**
   * Convenience method to get commonly used quality value
   */
  getDefaultQuality(): number {
    return this.getImageProcessing().defaultQuality;
  }

  /**
   * Convenience method to check if we're in development mode
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV === CONSTANTS.ENV.DEVELOPMENT;
  }

  /**
   * Get environment-appropriate timeout for updates
   */
  getUpdateTimeout(): number {
    const config = this.getUIConfiguration();
    return this.isDevelopment() ? config.devUpdateTimeout : config.prodUpdateTimeout;
  }
}

// Export singleton instance
export const appConstants = AppConstantsService.getInstance();