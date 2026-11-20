import { DownloadConfig, UserSettings } from '@/shared/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationOptions {
  required?: boolean;
  allowEmpty?: boolean;
  customMessage?: string;
}

export class ValidationService {
  // ========================================
  // Basic Field Validation
  // ========================================

  static validateRequired(
    value: any,
    fieldName: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty && !options.allowEmpty) {
      return {
        isValid: false,
        errors: [options.customMessage || `${fieldName} is required`],
      };
    }

    return { isValid: true, errors: [] };
  }

  static validateNumberRange(
    value: number,
    fieldName: string,
    min?: number,
    max?: number
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        errors: [`${fieldName} must be a valid number`],
      };
    }

    if (min !== undefined && value < min) {
      errors.push(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && value > max) {
      errors.push(`${fieldName} must be no more than ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateFilePath(
    filePath: string,
    fieldName: string
  ): ValidationResult {
    const required = this.validateRequired(filePath, fieldName);
    if (!required.isValid) return required;
    if (filePath.includes('..') || filePath.includes('\0')) {
      return {
        isValid: false,
        errors: [`${fieldName} contains invalid or unsafe path characters`],
      };
    }
    return { isValid: true, errors: [] };
  }

  static validateFolderPath(
    folderPath: string,
    fieldName: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    if (!folderPath || typeof folderPath !== 'string') {
      if (options.required !== false) {
        return { isValid: false, errors: [`${fieldName} is required`] };
      }
      return { isValid: true, errors: [] };
    }

    return this.validateFilePath(folderPath, fieldName);
  }

  // ========================================
  // File Type Validation (using existing fileUtils)
  // ========================================

  static validateDownloadConfig(config: DownloadConfig): ValidationResult {
    const errors: string[] = [];

    // Part number column is required
    const partNoResult = this.validateRequired(
      config.partNoColumn,
      'Part Number Column'
    );
    errors.push(...partNoResult.errors);

    // Must have at least one download type
    if (!config.imageColumns.length && !config.pdfColumn) {
      errors.push('At least one Image URL column or PDF column is required');
    }

    // Image folder required if image columns selected
    if (config.imageColumns.length > 0) {
      const imageFolderResult = this.validateFolderPath(
        config.imageFolder,
        'Image Download Folder'
      );
      errors.push(...imageFolderResult.errors);
    }

    // PDF folder required if PDF column selected
    if (config.pdfColumn) {
      const pdfFolderResult = this.validateFolderPath(
        config.pdfFolder,
        'PDF Download Folder'
      );
      errors.push(...pdfFolderResult.errors);
    }

    // Validate worker count
    const workerResult = this.validateNumberRange(
      config.maxWorkers,
      'Max Workers',
      1,
      20
    );
    errors.push(...workerResult.errors);

    // Validate background processing settings
    if (config.backgroundProcessing.enabled) {
      const qualityResult = this.validateNumberRange(
        config.backgroundProcessing.quality,
        'JPEG Quality',
        60,
        100
      );
      errors.push(...qualityResult.errors);

      const edgeResult = this.validateNumberRange(
        config.backgroundProcessing.edgeThreshold,
        'Edge Threshold',
        10,
        100
      );
      errors.push(...edgeResult.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUserSettings(settings: UserSettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate download behavior settings
    const concurrentResult = this.validateNumberRange(
      settings.downloadBehavior.defaultConcurrentDownloads,
      'Concurrent Downloads',
      1,
      20
    );
    errors.push(...concurrentResult.errors);

    const connectionTimeoutResult = this.validateNumberRange(
      settings.downloadBehavior.connectionTimeout,
      'Connection Timeout',
      1,
      60
    );
    errors.push(...connectionTimeoutResult.errors);

    const readTimeoutResult = this.validateNumberRange(
      settings.downloadBehavior.readTimeout,
      'Read Timeout',
      10,
      300
    );
    errors.push(...readTimeoutResult.errors);

    const retryResult = this.validateNumberRange(
      settings.downloadBehavior.retryAttempts,
      'Retry Attempts',
      1,
      10
    );
    errors.push(...retryResult.errors);

    // Validate image processing settings
    const qualityResult = this.validateNumberRange(
      settings.imageProcessing.defaultQuality,
      'Default JPEG Quality',
      60,
      100
    );
    errors.push(...qualityResult.errors);

    const edgeThresholdResult = this.validateNumberRange(
      settings.imageProcessing.defaultEdgeThreshold,
      'Default Edge Threshold',
      10,
      100
    );
    errors.push(...edgeThresholdResult.errors);

    // Optional path validations (warn if invalid, don't fail)
    const pathsToCheck = [
      {
        path: settings.defaultPaths.imageDownloadFolder,
        name: 'Image Download Folder',
      },
      {
        path: settings.defaultPaths.pdfDownloadFolder,
        name: 'PDF Download Folder',
      },
      {
        path: settings.defaultPaths.sourceImageFolder,
        name: 'Source Image Folder',
      },
      {
        path: settings.defaultPaths.imageNetworkPath,
        name: 'Image Network Path',
      },
      { path: settings.defaultPaths.pdfNetworkPath, name: 'PDF Network Path' },
    ];

    for (const { path, name } of pathsToCheck) {
      if (path && path.trim()) {
        const pathResult = this.validateFolderPath(path, name, {
          required: false,
        });
        if (!pathResult.isValid) {
          warnings.push(`${name}: ${pathResult.errors.join(', ')}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
