/**
 * Tests for ErrorHandlingService
 * Comprehensive test coverage for error handling patterns used in the codebase
 */

import {
  ErrorHandlingService,
  BaseApplicationError,
  ValidationError,
  ConfigurationError,
  DownloadError,
  FileSystemError,
  NetworkError,
  PathSecurityError,
  errorHandler,
} from './ErrorHandlingService';

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;

  beforeEach(() => {
    service = ErrorHandlingService.getInstance();
    // Clear logging history before each test
    service['loggingService'].clearHistory();
  });

  describe('Error Classes', () => {
    test('ValidationError should include field details', () => {
      const error = new ValidationError('partNoColumn', null, 'is required');

      expect(error.field).toBe('partNoColumn');
      expect(error.value).toBe(null);
      expect(error.reason).toBe('is required');
      expect(error.message).toBe(
        'Validation failed for partNoColumn: is required'
      );
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context).toBe('Validation');
    });

    test('ConfigurationError should include setting details', () => {
      const error = new ConfigurationError(
        'imageFolder',
        'folder does not exist'
      );

      expect(error.setting).toBe('imageFolder');
      expect(error.message).toBe(
        'Configuration error for imageFolder: folder does not exist'
      );
      expect(error.code).toBe('CONFIG_ERROR');
    });

    test('DownloadError should include URL and HTTP status', () => {
      const error = new DownloadError(
        'https://example.com/image.jpg',
        'Network timeout',
        504,
        2
      );

      expect(error.url).toBe('https://example.com/image.jpg');
      expect(error.httpStatus).toBe(504);
      expect(error.retryAttempt).toBe(2);
      expect(error.code).toBe('DOWNLOAD_ERROR');
    });

    test('FileSystemError should include operation and path', () => {
      const error = new FileSystemError(
        'write',
        '/tmp/test.jpg',
        'Permission denied'
      );

      expect(error.operation).toBe('write');
      expect(error.filePath).toBe('/tmp/test.jpg');
      expect(error.code).toBe('FILESYSTEM_ERROR');
    });

    test('NetworkError should include operation and status code', () => {
      const error = new NetworkError('request', 'Connection refused', 503);

      expect(error.operation).toBe('request');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('handleError', () => {
    test('should handle BaseApplicationError instances', () => {
      const originalError = new ValidationError('test', 'value', 'invalid');

      const result = service.handleError(originalError, 'TestContext', {
        throwOnError: false,
      });

      expect(result).toBe(originalError);
      expect(result.context).toBe('Validation');
    });

    test('should convert PathSecurityError to FileSystemError', () => {
      const originalError = new PathSecurityError(
        'Path traversal detected',
        '../../../etc/passwd'
      );

      expect(() => {
        service.handleError(originalError, 'TestContext');
      }).toThrow(FileSystemError);
    });

    test('should categorize generic Error by context', () => {
      const originalError = new Error('Part Number column is required');

      expect(() => {
        service.handleError(originalError, 'Configuration');
      }).toThrow(ConfigurationError);
    });

    test('should categorize timeout errors as NetworkError', () => {
      const originalError = new Error(
        'ECONNABORTED: timeout of 30000ms exceeded'
      );

      expect(() => {
        service.handleError(originalError, 'Request');
      }).toThrow(NetworkError);
    });

    test('should categorize file not found errors as FileSystemError', () => {
      const originalError = new Error('ENOENT: no such file or directory');

      expect(() => {
        service.handleError(originalError, 'FileRead');
      }).toThrow(FileSystemError);
    });

    test('should handle unknown errors gracefully', () => {
      const unknownError = { message: 'Unknown error type' };

      expect(() => {
        service.handleError(unknownError, 'TestContext');
      }).toThrow(BaseApplicationError);
    });

    test('should not throw when throwOnError is false', () => {
      const error = new Error('Test error');

      const result = service.handleError(error, 'TestContext', {
        throwOnError: false,
      });

      expect(result).toBeInstanceOf(BaseApplicationError);
      expect(result.message).toBe(
        'Validation failed for TestContext: GENERIC_ERROR'
      );
    });
  });

  describe('withRetry', () => {
    test('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.withRetry(operation, 'TestOperation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('request', 'timeout'))
        .mockResolvedValue('success');

      const result = await service.withRetry(operation, 'TestOperation', {
        maxAttempts: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should not retry on non-retryable errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new ValidationError('field', 'value', 'invalid'));

      await expect(
        service.withRetry(operation, 'TestOperation', { maxAttempts: 3 })
      ).rejects.toThrow(ValidationError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should fail after max attempts', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new NetworkError('request', 'timeout'));

      await expect(
        service.withRetry(operation, 'TestOperation', { maxAttempts: 2 })
      ).rejects.toThrow(BaseApplicationError);

      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should apply exponential backoff', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('request', 'timeout'))
        .mockRejectedValueOnce(new NetworkError('request', 'timeout'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      const result = await service.withRetry(operation, 'TestOperation', {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffFactor: 2,
      });
      const endTime = Date.now();

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      // Should take at least 100ms (first retry) + 200ms (second retry) = 300ms
      expect(endTime - startTime).toBeGreaterThan(200);
    });
  });

  describe('wrapAsync', () => {
    test('should execute function successfully', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrapped = service.wrapAsync(fn, 'TestContext', {
        throwOnError: true,
      });

      const result = await wrapped('arg1', 'arg2');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should handle errors and rethrow', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrapped = service.wrapAsync(fn, 'TestContext');

      await expect(wrapped()).rejects.toThrow(BaseApplicationError);
    });
  });

  describe('formatErrorForUser', () => {
    test('should format validation errors for users', () => {
      const error = new ValidationError('partNoColumn', null, 'is required');
      const formatted = service.formatErrorForUser(error);

      expect(formatted).toBe('Please check partNoColumn: is required');
    });

    test('should format download errors based on HTTP status', () => {
      const notFoundError = new DownloadError(
        'https://example.com/image.jpg',
        'Not found',
        404
      );
      expect(service.formatErrorForUser(notFoundError)).toBe(
        'File not found. Please check the URL.'
      );

      const serverError = new DownloadError(
        'https://example.com/image.jpg',
        'Server error',
        500
      );
      expect(service.formatErrorForUser(serverError)).toBe(
        'Server error. Please try again later.'
      );

      const genericError = new DownloadError(
        'https://example.com/image.jpg',
        'Network error'
      );
      expect(service.formatErrorForUser(genericError)).toBe(
        'Download failed. Please check your internet connection.'
      );
    });

    test('should format file system errors appropriately', () => {
      const permissionError = new FileSystemError(
        'write',
        '/tmp/test.jpg',
        'Permission denied'
      );
      expect(service.formatErrorForUser(permissionError)).toBe(
        'Permission denied. Please check file permissions.'
      );

      const notFoundError = new FileSystemError(
        'read',
        '/tmp/missing.jpg',
        'File not found'
      );
      expect(service.formatErrorForUser(notFoundError)).toBe(
        'File or folder not found. Please check the path.'
      );

      const existsError = new FileSystemError(
        'create',
        '/tmp/existing.jpg',
        'File already exists'
      );
      expect(service.formatErrorForUser(existsError)).toBe(
        'File already exists. Please choose a different location.'
      );
    });

    test('should format network errors generically', () => {
      const networkError = new NetworkError('request', 'Connection failed');
      const formatted = service.formatErrorForUser(networkError);

      expect(formatted).toBe(
        'Network error. Please check your internet connection.'
      );
    });

    test('should provide generic message for unknown errors', () => {
      const unknownError = new BaseApplicationError(
        'Unknown issue',
        'Unknown',
        'UNKNOWN'
      );
      const formatted = service.formatErrorForUser(unknownError);

      expect(formatted).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('validateDownloadConfig', () => {
    test('should return no errors for valid config', () => {
      const validConfig = {
        partNoColumn: 'PartNumber',
        imageColumns: ['ImageURL'],
        imageFolder: '/tmp/images',
        maxWorkers: 5,
      };

      const errors = service.validateDownloadConfig(validConfig);

      expect(errors).toHaveLength(0);
    });

    test('should validate required partNoColumn', () => {
      const config = {};

      const errors = service.validateDownloadConfig(config);

      expect(errors).toHaveLength(3); // partNoColumn, columns, folders
      expect(errors[0]).toBeInstanceOf(ValidationError);
      expect(errors[0].field).toBe('partNoColumn');
    });

    test('should validate at least one column is selected', () => {
      const config = {
        partNoColumn: 'PartNumber',
        imageColumns: [],
        pdfColumn: null,
      };

      const errors = service.validateDownloadConfig(config);

      expect(errors.some(e => e.field === 'columns')).toBe(true);
    });

    test('should validate at least one folder is specified', () => {
      const config = {
        partNoColumn: 'PartNumber',
        imageColumns: ['ImageURL'],
        imageFolder: '',
        pdfFolder: '',
      };

      const errors = service.validateDownloadConfig(config);

      expect(errors.some(e => e.field === 'folders')).toBe(true);
    });

    test('should validate maxWorkers range', () => {
      const config = {
        partNoColumn: 'PartNumber',
        imageColumns: ['ImageURL'],
        imageFolder: '/tmp/images',
        maxWorkers: 25,
      };

      const errors = service.validateDownloadConfig(config);

      expect(errors.some(e => e.field === 'maxWorkers')).toBe(true);
    });
  });

  describe('safeFileOperation', () => {
    test('should execute operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('file content');

      const result = await service.safeFileOperation(
        operation,
        'read',
        '/tmp/test.txt'
      );

      expect(result).toBe('file content');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should convert PathSecurityError to FileSystemError', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(
          new PathSecurityError(
            'Path traversal detected',
            '../../../etc/passwd'
          )
        );

      await expect(
        service.safeFileOperation(operation, 'read', '/tmp/test.txt')
      ).rejects.toThrow(FileSystemError);
    });

    test('should wrap generic errors in FileSystemError', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('ENOENT: file not found'));

      await expect(
        service.safeFileOperation(operation, 'read', '/tmp/test.txt')
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('getErrorStats', () => {
    test('should return empty stats initially', () => {
      const stats = service.getErrorStats();

      expect(stats).toEqual({});
    });

    test('should track error occurrences', () => {
      // Generate some errors to track
      try {
        service.handleError(
          new ValidationError('field1', 'value', 'invalid'),
          'Test'
        );
      } catch {
        // Expected to catch thrown error
      }

      try {
        service.handleError(
          new ValidationError('field2', 'value', 'invalid'),
          'Test'
        );
      } catch {
        // Expected to catch thrown error
      }

      try {
        service.handleError(new DownloadError('url', 'failed'), 'Test');
      } catch {
        // Expected to catch thrown error
      }

      const stats = service.getErrorStats();

      expect(stats['ValidationError']).toBe(2);
      expect(stats['DownloadError']).toBe(1);
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = ErrorHandlingService.getInstance();
      const instance2 = ErrorHandlingService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(errorHandler);
    });
  });

  describe('Error Categorization Patterns', () => {
    test('should categorize axios timeout errors', () => {
      const axiosError = new Error('timeout of 30000ms exceeded');

      expect(() => {
        service.handleError(axiosError, 'Download');
      }).toThrow(NetworkError);
    });

    test('should categorize connection refused errors', () => {
      const connError = new Error('ECONNREFUSED: Connection refused');

      expect(() => {
        service.handleError(connError, 'Network');
      }).toThrow(NetworkError);
    });

    test('should categorize permission errors', () => {
      const permError = new Error('EACCES: permission denied');

      expect(() => {
        service.handleError(permError, 'FileSystem');
      }).toThrow(FileSystemError);
    });

    test('should handle download context errors', () => {
      const downloadError = new Error('Failed to download image');

      expect(() => {
        service.handleError(downloadError, 'Download');
      }).toThrow(DownloadError);
    });
  });
});
