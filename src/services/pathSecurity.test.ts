import * as path from 'path';
import * as fs from 'fs/promises';
import {
  sanitizePath,
  isPathSafe,
  safeJoin,
  validateFileAccess,
  safeReadDir,
  PathSecurityError,
} from './pathSecurity';

// Mock fs/promises
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('pathSecurity', () => {
  const testRoot = '/safe/root';
  const testFile = '/safe/root/test.txt';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizePath', () => {
    it('should sanitize valid paths', () => {
      const result = sanitizePath('test.txt', testRoot);
      expect(result).toBe(path.resolve(testRoot, 'test.txt'));
    });

    it('should throw on null or invalid input', () => {
      expect(() => sanitizePath(null as any, testRoot)).toThrow(
        PathSecurityError
      );
      expect(() => sanitizePath('', testRoot)).toThrow(PathSecurityError);
      expect(() => sanitizePath(123 as any, testRoot)).toThrow(
        PathSecurityError
      );
    });

    it('should detect and prevent path traversal with ..', () => {
      expect(() => sanitizePath('../etc/passwd', testRoot)).toThrow(
        PathSecurityError
      );
      expect(() => sanitizePath('../../etc/passwd', testRoot)).toThrow(
        PathSecurityError
      );
      expect(() => sanitizePath('test/../../../etc/passwd', testRoot)).toThrow(
        PathSecurityError
      );
    });

    it('should detect null byte injection', () => {
      expect(() => sanitizePath('test.txt\0.jpg', testRoot)).toThrow(
        PathSecurityError
      );
      expect(() => sanitizePath('test\0/etc/passwd', testRoot)).toThrow(
        PathSecurityError
      );
    });

    it('should enforce allowed root directory', () => {
      expect(() => sanitizePath('/etc/passwd', testRoot)).toThrow(
        PathSecurityError
      );
      expect(() => sanitizePath(path.resolve('/other/path'), testRoot)).toThrow(
        PathSecurityError
      );
    });

    it('should handle multiple allowed roots', () => {
      const options = { allowedRoots: ['/safe/root', '/another/safe'] };
      const result1 = sanitizePath('test.txt', '/safe/root', options);
      expect(result1).toBe(path.resolve('/safe/root', 'test.txt'));

      const result2 = sanitizePath('test.txt', '/another/safe', options);
      expect(result2).toBe(path.resolve('/another/safe', 'test.txt'));

      expect(() => sanitizePath('test.txt', '/unsafe', options)).toThrow(
        PathSecurityError
      );
    });

    it('should handle paths without allowed root', () => {
      const result = sanitizePath('test.txt');
      expect(result).toBe(path.resolve('test.txt'));
    });
  });

  describe('isPathSafe', () => {
    it('should return true for safe paths', () => {
      expect(isPathSafe('test.txt', testRoot)).toBe(true);
      expect(isPathSafe('folder/test.txt', testRoot)).toBe(true);
    });

    it('should return false for unsafe paths', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(isPathSafe('../etc/passwd', testRoot)).toBe(false);
      expect(isPathSafe('../../etc/passwd', testRoot)).toBe(false);
      expect(isPathSafe('test\0.txt', testRoot)).toBe(false);

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should handle invalid path types', () => {
      // Invalid path types should return false after being caught by sanitizePath
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(isPathSafe(123 as any, testRoot)).toBe(false);
      expect(isPathSafe({} as any, testRoot)).toBe(false);

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('safeJoin', () => {
    it('should safely join path components', () => {
      const result = safeJoin(testRoot, 'folder', 'file.txt');
      expect(result).toBe(path.resolve(testRoot, 'folder', 'file.txt'));
    });

    it('should throw on invalid base path', () => {
      expect(() => safeJoin('', 'test')).toThrow(PathSecurityError);
      expect(() => safeJoin(null as any, 'test')).toThrow(PathSecurityError);
    });

    it('should throw on invalid components', () => {
      expect(() => safeJoin(testRoot, null as any)).toThrow(PathSecurityError);
      expect(() => safeJoin(testRoot, '')).toThrow(PathSecurityError);
      expect(() => safeJoin(testRoot, 123 as any)).toThrow(PathSecurityError);
    });

    it('should prevent traversal in components', () => {
      expect(() => safeJoin(testRoot, '../etc')).toThrow(PathSecurityError);
      expect(() => safeJoin(testRoot, 'test', '../../etc')).toThrow(
        PathSecurityError
      );
      expect(() => safeJoin(testRoot, 'test\0.txt')).toThrow(PathSecurityError);
    });

    it('should prevent absolute paths in components', () => {
      expect(() => safeJoin(testRoot, '/etc/passwd')).toThrow(
        PathSecurityError
      );
      // On Windows, this would be an absolute path: C:\Windows\System32
      // On Unix, test with another absolute path
      if (process.platform === 'win32') {
        expect(() => safeJoin(testRoot, 'C:\\Windows\\System32')).toThrow(
          PathSecurityError
        );
      } else {
        expect(() => safeJoin(testRoot, '/usr/bin')).toThrow(PathSecurityError);
      }
    });
  });

  describe('validateFileAccess', () => {
    it('should return true for accessible files', async () => {
      mockedFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await validateFileAccess(testFile, testRoot);
      expect(result).toBe(true);
      expect(mockedFs.stat).toHaveBeenCalledWith(testFile);
    });

    it('should return false for directories', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockedFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);

      const result = await validateFileAccess(testFile, testRoot);
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not a file')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should return false for non-existent files', async () => {
      mockedFs.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await validateFileAccess(testFile, testRoot);
      expect(result).toBe(false);
    });

    it('should return false for unsafe paths', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await validateFileAccess('../etc/passwd', testRoot);
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('File access denied')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('safeReadDir', () => {
    it('should read directory contents safely', async () => {
      mockedFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);
      mockedFs.readdir.mockResolvedValue([
        'file1.txt',
        'file2.txt',
        'subfolder',
      ] as any);

      const result = await safeReadDir(testRoot);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(path.resolve(testRoot, 'file1.txt'));
      expect(result[1]).toBe(path.resolve(testRoot, 'file2.txt'));
      expect(result[2]).toBe(path.resolve(testRoot, 'subfolder'));
    });

    it('should throw for non-directory paths', async () => {
      mockedFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      await expect(safeReadDir(testFile, testRoot)).rejects.toThrow(
        PathSecurityError
      );
    });

    it('should skip unsafe entries', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockedFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);
      mockedFs.readdir.mockResolvedValue([
        'safe.txt',
        '..',
        'test\0.txt',
      ] as any);

      const result = await safeReadDir(testRoot);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path.resolve(testRoot, 'safe.txt'));
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });

    it('should throw PathSecurityError for unsafe directory path', async () => {
      await expect(safeReadDir('../etc', testRoot)).rejects.toThrow(
        PathSecurityError
      );
    });

    it('should wrap I/O errors in PathSecurityError', async () => {
      mockedFs.stat.mockRejectedValue(new Error('Permission denied'));

      await expect(safeReadDir(testRoot)).rejects.toThrow(PathSecurityError);
      await expect(safeReadDir(testRoot)).rejects.toThrow(
        'Failed to read directory'
      );
    });
  });

  describe('PathSecurityError', () => {
    it('should store attempted path', () => {
      const error = new PathSecurityError('Test error', '/unsafe/path');
      expect(error.attemptedPath).toBe('/unsafe/path');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('PathSecurityError');
    });
  });
});
