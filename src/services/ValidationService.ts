import { DownloadConfig, UserSettings } from '@/shared/types';
import { isPathSafe, PathSecurityError } from './pathSecurity';
import { isImageFile, isPdfFile, isCsvFile, isExcelFile } from './fileUtils';

/**
 * ValidationService - Centralized validation for the application
 *
 * Follows KISS/DRY principles by consolidating 42+ validation patterns
 * found throughout the codebase into reusable functions.
 *
 * Single Responsibility: Only handles validation logic
 * YAGNI: Only includes currently needed validation methods
 */

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

  /**
   * Validate required field - most common validation pattern in codebase
   * Found in: ProcessTab.tsx (lines 80, 86, 92), ColumnSelectionTab.tsx
   */
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

  /**
   * Validate string length - common in UI components
   * Found in: NumberInput.tsx, SettingsTab.tsx
   */
  static validateStringLength(
    value: string,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): ValidationResult {
    const errors: string[] = [];

    if (!value || typeof value !== 'string') {
      return { isValid: false, errors: [`${fieldName} must be a string`] };
    }

    const trimmedValue = value.trim();

    if (minLength !== undefined && trimmedValue.length < minLength) {
      errors.push(`${fieldName} must be at least ${minLength} characters long`);
    }

    if (maxLength !== undefined && trimmedValue.length > maxLength) {
      errors.push(
        `${fieldName} must be no more than ${maxLength} characters long`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate number range - found in NumberInput.tsx, SettingsTab.tsx
   * Used for maxWorkers (1-20), quality (60-100), timeout values
   */
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

  /**
   * Validate email format - basic email validation
   * Standard pattern for contact forms, user settings
   */
  static validateEmail(
    email: string,
    fieldName: string = 'Email'
  ): ValidationResult {
    if (!email || typeof email !== 'string') {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim();

    if (trimmedEmail === '') {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }

    if (!emailRegex.test(trimmedEmail)) {
      return {
        isValid: false,
        errors: [`${fieldName} must be a valid email address`],
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validate URL format - found in downloadService.ts for URL validation
   * Used for image URLs, PDF URLs
   */
  static validateUrl(url: string, fieldName: string = 'URL'): ValidationResult {
    if (!url || typeof url !== 'string') {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }

    const trimmedUrl = url.trim();

    if (trimmedUrl === '') {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }

    try {
      // Accept both HTTP/HTTPS URLs and local file paths
      if (
        trimmedUrl.startsWith('http://') ||
        trimmedUrl.startsWith('https://')
      ) {
        new URL(trimmedUrl); // Will throw if invalid
        return { isValid: true, errors: [] };
      }

      // For local paths, check for basic file path patterns
      // Reject obvious invalid cases like "not-a-url" or "ftp://invalid"
      if (
        trimmedUrl.includes('://') &&
        !trimmedUrl.startsWith('http://') &&
        !trimmedUrl.startsWith('https://')
      ) {
        return {
          isValid: false,
          errors: [`${fieldName} must be a valid URL or file path`],
        };
      }

      // Accept local file paths (should have path separators or be a simple filename)
      if (
        trimmedUrl.includes('/') ||
        trimmedUrl.includes('\\') ||
        trimmedUrl.includes('.')
      ) {
        return { isValid: true, errors: [] };
      }

      // Reject single words that don't look like URLs or paths
      return {
        isValid: false,
        errors: [`${fieldName} must be a valid URL or file path`],
      };
    } catch {
      return { isValid: false, errors: [`${fieldName} must be a valid URL`] };
    }
  }

  // ========================================
  // Path Validation (using existing pathSecurity)
  // ========================================

  /**
   * Validate file path using existing pathSecurity service
   * Found throughout: pathSecurity.ts, downloadService.ts, excelService.ts
   */
  static validateFilePath(
    filePath: string,
    fieldName: string,
    allowedRoot?: string
  ): ValidationResult {
    try {
      const requiredResult = this.validateRequired(filePath, fieldName);
      if (!requiredResult.isValid) {
        return requiredResult;
      }

      const trimmedPath = filePath.trim();

      // Use existing pathSecurity validation
      if (!isPathSafe(trimmedPath, allowedRoot)) {
        return {
          isValid: false,
          errors: [`${fieldName} contains invalid or unsafe path characters`],
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof PathSecurityError) {
        return {
          isValid: false,
          errors: [`${fieldName}: ${error.message}`],
        };
      }

      return {
        isValid: false,
        errors: [
          `${fieldName} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Validate folder path - commonly used in settings and configuration
   * Found in: SettingsTab.tsx, ProcessTab.tsx for download folders
   */
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

  /**
   * Validate file type based on extension
   * Found in: fileUtils.ts, excelService.ts, downloadService.ts
   */
  static validateFileType(
    fileName: string,
    fieldName: string,
    allowedTypes: ('excel' | 'csv' | 'image' | 'pdf')[]
  ): ValidationResult {
    if (!fileName || typeof fileName !== 'string') {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }

    const trimmedName = fileName.trim();

    const typeCheckers = {
      excel: isExcelFile,
      csv: isCsvFile,
      image: isImageFile,
      pdf: isPdfFile,
    };

    const isValidType = allowedTypes.some(type =>
      typeCheckers[type](trimmedName)
    );

    if (!isValidType) {
      const typeNames = allowedTypes.join(', ');
      return {
        isValid: false,
        errors: [`${fieldName} must be one of these file types: ${typeNames}`],
      };
    }

    return { isValid: true, errors: [] };
  }

  // ========================================
  // Configuration Validation
  // ========================================

  /**
   * Validate download configuration - found in ProcessTab.tsx validation logic
   * Centralizes all the validation checks scattered across the UI
   */
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

  /**
   * Validate user settings - found in SettingsTab.tsx
   * Consolidates settings validation from the UI
   */
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

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Validate multiple fields at once
   * Useful for form validation
   */
  static validateFields(validations: ValidationResult[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const result of validations) {
      allErrors.push(...result.errors);
      if (result.warnings) {
        allWarnings.push(...result.warnings);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  }

  /**
   * Sanitize string input - common pattern throughout codebase
   * Found in: downloadService.ts sanitizeFilename, various form inputs
   */
  static sanitizeString(
    input: string,
    options: {
      allowSpecialChars?: boolean;
      maxLength?: number;
      replaceSpaces?: boolean;
    } = {}
  ): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Replace spaces with underscores if requested (like in downloadService.ts)
    if (options.replaceSpaces) {
      sanitized = sanitized.replace(/\s+/g, '_');
    }

    // Remove special characters if not allowed (like in downloadService.ts)
    if (!options.allowSpecialChars) {
      sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.\s]/g, '');
    }

    // Truncate if max length specified
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Check if array has duplicates - useful for column selection validation
   */
  static hasDuplicates<T>(array: T[]): boolean {
    return new Set(array).size !== array.length;
  }

  /**
   * Validate array has no duplicates
   */
  static validateNoDuplicates<T>(
    array: T[],
    fieldName: string,
    identifier?: (item: T) => string
  ): ValidationResult {
    if (!Array.isArray(array)) {
      return { isValid: false, errors: [`${fieldName} must be an array`] };
    }

    const values: (T | string)[] = identifier ? array.map(identifier) : array;

    if (this.hasDuplicates(values)) {
      return {
        isValid: false,
        errors: [`${fieldName} cannot contain duplicate values`],
      };
    }

    return { isValid: true, errors: [] };
  }
}
