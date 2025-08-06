/**
 * ErrorHandlingService - Standardized error handling for the Digital Assets Downloader
 * Follows KISS, DRY, and SOLID principles:
 * - Single Responsibility: Manages all error handling concerns
 * - DRY: Reusable error handling patterns
 * - KISS: Simple, focused error handling strategies
 * - YAGNI: Based on actual codebase patterns, not over-engineered
 */

import { LoggingService, logger } from './LoggingService';
import { PathSecurityError } from './pathSecurity';

// Base error types found in the codebase
export abstract class BaseApplicationError extends Error {
  public readonly timestamp: Date;
  public readonly context?: string;
  public readonly code?: string;

  constructor(message: string, context?: string, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    this.code = code;
    
    // Maintain proper stack trace
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Error classes based on patterns found in downloadService.ts, main.ts, and pathSecurity.ts
export class ValidationError extends BaseApplicationError {
  constructor(field: string, value: any, reason: string) {
    super(`Validation failed for ${field}: ${reason}`, 'Validation', 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
    this.reason = reason;
  }

  public readonly field: string;
  public readonly value: any;
  public readonly reason: string;
}

export class ConfigurationError extends BaseApplicationError {
  constructor(setting: string, issue: string) {
    super(`Configuration error for ${setting}: ${issue}`, 'Configuration', 'CONFIG_ERROR');
    this.setting = setting;
  }

  public readonly setting: string;
}

export class DownloadError extends BaseApplicationError {
  constructor(url: string, reason: string, httpStatus?: number, retryAttempt?: number) {
    super(`Download failed for ${url}: ${reason}`, 'Download', 'DOWNLOAD_ERROR');
    this.url = url;
    this.httpStatus = httpStatus;
    this.retryAttempt = retryAttempt;
  }

  public readonly url: string;
  public readonly httpStatus?: number;
  public readonly retryAttempt?: number;
}

export class FileSystemError extends BaseApplicationError {
  constructor(operation: string, filePath: string, reason: string) {
    super(`File system ${operation} failed for ${filePath}: ${reason}`, 'FileSystem', 'FILESYSTEM_ERROR');
    this.operation = operation;
    this.filePath = filePath;
  }

  public readonly operation: string;
  public readonly filePath: string;
}

export class NetworkError extends BaseApplicationError {
  constructor(operation: string, reason: string, statusCode?: number) {
    super(`Network ${operation} failed: ${reason}`, 'Network', 'NETWORK_ERROR');
    this.operation = operation;
    this.statusCode = statusCode;
  }

  public readonly operation: string;
  public readonly statusCode?: number;
}

// Retry configuration
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrors: string[];
}

export interface ErrorHandlingOptions {
  logErrors: boolean;
  throwOnError: boolean;
  maxRetries: number;
  context?: string;
}

// Default configurations based on codebase analysis
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableErrors: ['NETWORK_ERROR', 'DOWNLOAD_ERROR', 'TIMEOUT_ERROR']
};

const DEFAULT_ERROR_OPTIONS: ErrorHandlingOptions = {
  logErrors: true,
  throwOnError: true,
  maxRetries: 3
};

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private loggingService: LoggingService;

  private constructor() {
    this.loggingService = LoggingService.getInstance();
  }

  static getInstance(): ErrorHandlingService {
    if (!this.instance) {
      this.instance = new ErrorHandlingService();
    }
    return this.instance;
  }

  /**
   * Handle errors with consistent logging and formatting
   * Based on patterns from downloadService.ts (lines 203-210, 296-304, 448-476)
   */
  handleError(
    error: unknown, 
    context: string, 
    options: Partial<ErrorHandlingOptions> = {}
  ): BaseApplicationError {
    const mergedOptions = { ...DEFAULT_ERROR_OPTIONS, ...options };
    
    let handledError: BaseApplicationError;

    if (error instanceof BaseApplicationError) {
      handledError = error;
    } else if (error instanceof PathSecurityError) {
      handledError = new FileSystemError('security_check', error.attemptedPath, error.message);
    } else if (error instanceof Error) {
      // Convert generic errors to application errors based on context
      handledError = this.categorizeError(error, context);
    } else {
      handledError = new BaseApplicationError(
        `Unknown error: ${String(error)}`,
        context,
        'UNKNOWN_ERROR'
      );
    }

    if (mergedOptions.logErrors) {
      this.loggingService.error(handledError.message, handledError, handledError.context);
    }

    if (mergedOptions.throwOnError) {
      throw handledError;
    }

    return handledError;
  }

  /**
   * Categorize generic errors into application-specific error types
   * Based on error patterns found in the codebase
   */
  private categorizeError(error: Error, context: string): BaseApplicationError {
    const message = error.message.toLowerCase();
    
    // Network-related errors (axios patterns from downloadService.ts)
    if (message.includes('econnaborted') || message.includes('timeout')) {
      return new NetworkError('request', 'Connection timeout', undefined);
    }
    
    if (message.includes('econnrefused') || message.includes('network')) {
      return new NetworkError('connection', error.message);
    }

    // File system errors (patterns from main.ts and downloadService.ts)
    if (message.includes('enoent') || message.includes('file not found')) {
      return new FileSystemError('read', 'unknown', 'File not found');
    }

    if (message.includes('eacces') || message.includes('permission')) {
      return new FileSystemError('access', 'unknown', 'Permission denied');
    }

    if (message.includes('eexist') || message.includes('already exists')) {
      return new FileSystemError('create', 'unknown', 'File already exists');
    }

    // Download-specific errors
    if (context === 'Download' || context === 'download') {
      return new DownloadError('unknown', error.message);
    }

    // Configuration errors (patterns from main.ts lines 322-333)
    if (message.includes('column') || message.includes('configuration')) {
      return new ConfigurationError('unknown', error.message);
    }

    // Default to base error
    return new BaseApplicationError(error.message, context, 'GENERIC_ERROR');
  }

  /**
   * Execute an operation with retry logic and exponential backoff
   * Based on retry patterns from downloadService.ts (lines 384-476)
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    retryOptions: Partial<RetryOptions> = {}
  ): Promise<T> {
    const options = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
    let lastError: Error;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error, options.retryableErrors)) {
          throw this.handleError(error, context);
        }

        // Don't delay on last attempt
        if (attempt < options.maxAttempts) {
          const delay = this.calculateBackoffDelay(attempt, options);
          logger.warn(`${context} failed (attempt ${attempt}/${options.maxAttempts}), retrying in ${delay}ms`, context, { error: lastError.message });
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    throw new BaseApplicationError(
      `${context} failed after ${options.maxAttempts} attempts: ${lastError.message}`,
      context,
      'RETRY_EXHAUSTED'
    );
  }

  /**
   * Check if error should be retried
   */
  private isRetryableError(error: unknown, retryableErrors: string[]): boolean {
    if (error instanceof BaseApplicationError && error.code) {
      return retryableErrors.includes(error.code);
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('econnaborted') ||
        message.includes('enotfound')
      );
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   * Implementation based on downloadService.ts line 471
   */
  private calculateBackoffDelay(attempt: number, options: RetryOptions): number {
    const delay = options.baseDelayMs * Math.pow(options.backoffFactor, attempt - 1);
    return Math.min(delay, options.maxDelayMs);
  }

  /**
   * Promise-based delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap async functions with error handling
   * Standardizes error handling across the application
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string,
    options: Partial<ErrorHandlingOptions> = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        throw this.handleError(error, context, options);
      }
    };
  }

  /**
   * Format error for user display
   * Converts technical errors to user-friendly messages
   */
  formatErrorForUser(error: BaseApplicationError): string {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        if (error instanceof ValidationError) {
          return `Please check ${error.field}: ${error.reason}`;
        }
        return 'Please check your input and try again.';
        
      case 'CONFIG_ERROR':
        if (error instanceof ConfigurationError) {
          return `Configuration issue: ${error.setting}. Please check your settings.`;
        }
        return 'Please check your configuration and try again.';
        
      case 'DOWNLOAD_ERROR':
        if (error instanceof DownloadError) {
          if (error.httpStatus === 404) {
            return 'File not found. Please check the URL.';
          }
          if (error.httpStatus && error.httpStatus >= 500) {
            return 'Server error. Please try again later.';
          }
          return 'Download failed. Please check your internet connection.';
        }
        return 'Download failed. Please try again.';
        
      case 'FILESYSTEM_ERROR':
        if (error instanceof FileSystemError) {
          if (error.message.toLowerCase().includes('permission')) {
            return 'Permission denied. Please check file permissions.';
          }
          if (error.message.toLowerCase().includes('not found')) {
            return 'File or folder not found. Please check the path.';
          }
          if (error.message.toLowerCase().includes('already exists')) {
            return 'File already exists. Please choose a different location.';
          }
        }
        return 'File system error. Please check permissions and try again.';
        
      case 'NETWORK_ERROR':
        return 'Network error. Please check your internet connection.';
        
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Validate configuration object
   * Based on validation patterns from main.ts (lines 322-333)
   */
  validateDownloadConfig(config: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!config.partNoColumn) {
      errors.push(new ValidationError('partNoColumn', config.partNoColumn, 'Part Number column is required'));
    }

    if (!config.imageColumns?.length && !config.pdfColumn) {
      errors.push(new ValidationError('columns', { imageColumns: config.imageColumns, pdfColumn: config.pdfColumn }, 'At least one Image URL column or PDF column is required'));
    }

    if (!config.imageFolder && !config.pdfFolder) {
      errors.push(new ValidationError('folders', { imageFolder: config.imageFolder, pdfFolder: config.pdfFolder }, 'At least one download folder is required'));
    }

    if (config.maxWorkers && (config.maxWorkers < 1 || config.maxWorkers > 20)) {
      errors.push(new ValidationError('maxWorkers', config.maxWorkers, 'Max workers must be between 1 and 20'));
    }

    return errors;
  }

  /**
   * Safe file operation wrapper
   * Based on patterns from downloadService.ts and pathSecurity.ts
   */
  async safeFileOperation<T>(
    operation: () => Promise<T>,
    operationType: string,
    filePath: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PathSecurityError) {
        throw new FileSystemError('security_check', error.attemptedPath, error.message);
      }
      
      const fileError = new FileSystemError(operationType, filePath, 
        error instanceof Error ? error.message : 'Unknown error');
      
      this.loggingService.fileOperation(operationType, filePath, false, fileError);
      throw fileError;
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): { [errorType: string]: number } {
    const history = this.loggingService.getHistory();
    const errorStats: { [errorType: string]: number } = {};

    history
      .filter(entry => entry.level === 3) // ERROR level
      .forEach(entry => {
        if (entry.error?.name) {
          errorStats[entry.error.name] = (errorStats[entry.error.name] || 0) + 1;
        }
      });

    return errorStats;
  }
}

// Export singleton instance for convenience
export const errorHandler = ErrorHandlingService.getInstance();