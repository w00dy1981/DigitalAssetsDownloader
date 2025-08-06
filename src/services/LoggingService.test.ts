import { LoggingService, LogLevel, logger } from './LoggingService';

describe('LoggingService', () => {
  let service: LoggingService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    service = LoggingService.getInstance();
    service.clearHistory();
    service.setLogLevel(LogLevel.DEBUG);
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LoggingService.getInstance();
      const instance2 = LoggingService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export logger as singleton instance', () => {
      expect(logger).toBe(LoggingService.getInstance());
    });
  });

  describe('Log Levels', () => {
    it('should set and get log level', () => {
      service.setLogLevel(LogLevel.WARN);
      expect(service.getLogLevel()).toBe(LogLevel.WARN);
    });

    it('should not log messages below current level', () => {
      service.setLogLevel(LogLevel.WARN);
      
      service.debug('debug message');
      service.info('info message');
      service.warn('warn message');
      service.error('error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging Methods', () => {
    it('should log debug messages', () => {
      service.debug('Debug message', 'TestContext', { data: 'test' });
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[DEBUG]');
      expect(loggedMessage).toContain('[TestContext]');
      expect(loggedMessage).toContain('Debug message');
    });

    it('should log info messages', () => {
      service.info('Info message', 'TestContext');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[INFO]');
      expect(loggedMessage).toContain('Info message');
    });

    it('should log warn messages', () => {
      service.warn('Warning message', 'TestContext');
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[WARN]');
      expect(loggedMessage).toContain('Warning message');
    });

    it('should log error messages with Error object', () => {
      const error = new Error('Test error');
      service.error('Error message', error, 'TestContext');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[ERROR]');
      expect(loggedMessage).toContain('Error message');
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(error);
    });

    it('should log error messages with string', () => {
      service.error('Error message', 'Error string', 'TestContext');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedError = consoleErrorSpy.mock.calls[0][1];
      expect(loggedError).toBeInstanceOf(Error);
      expect(loggedError.message).toBe('Error string');
    });
  });

  describe('Message Formatting', () => {
    it('should include timestamp in ISO format', () => {
      const beforeTime = new Date().toISOString();
      service.info('Test message');
      const afterTime = new Date().toISOString();
      
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      const timestampMatch = loggedMessage.match(/\[([\d\-T:.Z]+)\]/);
      expect(timestampMatch).toBeTruthy();
      
      const timestamp = new Date(timestampMatch[1]);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });

    it('should format message without context when not provided', () => {
      service.info('Test message');
      
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toMatch(/\[[\d\-T:.Z]+\] \[INFO\] Test message/);
    });

    it('should format message with context when provided', () => {
      service.info('Test message', 'MyContext');
      
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toMatch(/\[[\d\-T:.Z]+\] \[INFO\]\[MyContext\] Test message/);
    });
  });

  describe('Log History', () => {
    it('should maintain log history', () => {
      service.info('Message 1');
      service.warn('Message 2');
      service.error('Message 3');

      const history = service.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('Message 1');
      expect(history[1].message).toBe('Message 2');
      expect(history[2].message).toBe('Message 3');
    });

    it('should filter history by log level', () => {
      service.info('Info 1');
      service.warn('Warn 1');
      service.info('Info 2');
      service.error('Error 1');

      const infoLogs = service.getHistory(LogLevel.INFO);
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs[0].message).toBe('Info 1');
      expect(infoLogs[1].message).toBe('Info 2');
    });

    it('should limit history size to maxHistorySize', () => {
      // Set a small history size for testing
      const maxSize = 5;
      (service as any).maxHistorySize = maxSize;

      for (let i = 0; i < 10; i++) {
        service.info(`Message ${i}`);
      }

      const history = service.getHistory();
      expect(history).toHaveLength(maxSize);
      expect(history[0].message).toBe('Message 5');
      expect(history[maxSize - 1].message).toBe('Message 9');
    });

    it('should clear history', () => {
      service.info('Message 1');
      service.info('Message 2');
      
      service.clearHistory();
      
      const history = service.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should log download progress', () => {
      service.downloadProgress('file.txt', 50, '1.5 MB/s');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Download progress: 50%');
      expect(loggedMessage).toContain('[Download]');
      
      const loggedData = consoleLogSpy.mock.calls[0][1];
      expect(loggedData).toEqual({
        fileName: 'file.txt',
        progress: 50,
        speed: '1.5 MB/s',
      });
    });

    it('should log successful file operations', () => {
      service.fileOperation('Read', '/path/to/file.txt', true);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Read: /path/to/file.txt');
      expect(loggedMessage).toContain('[FileSystem]');
    });

    it('should log failed file operations', () => {
      const error = new Error('File not found');
      service.fileOperation('Read', '/path/to/file.txt', false, error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Read: /path/to/file.txt');
      expect(loggedMessage).toContain('[FileSystem]');
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(error);
    });

    it('should log successful validation', () => {
      service.validation('email', true);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Validation passed for email');
      expect(loggedMessage).toContain('[Validation]');
    });

    it('should log failed validation with reason', () => {
      service.validation('email', false, 'Invalid format');
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Validation failed for email: Invalid format');
      expect(loggedMessage).toContain('[Validation]');
    });
  });
});