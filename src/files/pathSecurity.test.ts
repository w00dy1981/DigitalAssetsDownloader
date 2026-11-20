import * as path from 'path';
import { sanitizePath, joinFilename, PathSecurityError } from './pathSecurity';

describe('pathSecurity', () => {
  const testRoot = '/safe/root';

  describe('sanitizePath', () => {
    it('should sanitize valid paths', () => {
      const result = sanitizePath('test.txt', testRoot);
      expect(result).toBe(path.resolve(testRoot, 'test.txt'));
    });

    it('should throw on null or invalid input', () => {
      expect(() => sanitizePath(null, testRoot)).toThrow(PathSecurityError);
      expect(() => sanitizePath('', testRoot)).toThrow(PathSecurityError);
      expect(() => sanitizePath(123, testRoot)).toThrow(PathSecurityError);
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

    it('should handle paths without allowed root', () => {
      const result = sanitizePath('test.txt');
      expect(result).toBe(path.resolve('test.txt'));
    });
  });

  describe('joinFilename', () => {
    it('should join a filename to its folder', () => {
      const result = joinFilename(testRoot, 'file.txt');
      expect(result).toBe(path.resolve(testRoot, 'file.txt'));
    });

    it('only accepts filenames directly in the folder', () => {
      expect(() => joinFilename(testRoot, '.')).toThrow(PathSecurityError);
      expect(() => joinFilename(testRoot, 'folder/file.txt')).toThrow(
        PathSecurityError
      );
    });

    it('should throw on invalid base path', () => {
      expect(() => joinFilename('', 'test')).toThrow(PathSecurityError);
      expect(() => joinFilename(null, 'test')).toThrow(PathSecurityError);
    });

    it('should throw on invalid filenames', () => {
      expect(() => joinFilename(testRoot, null)).toThrow(PathSecurityError);
      expect(() => joinFilename(testRoot, '')).toThrow(PathSecurityError);
      expect(() => joinFilename(testRoot, 123)).toThrow(PathSecurityError);
    });

    it('should prevent traversal in filenames', () => {
      expect(() => joinFilename(testRoot, '../etc')).toThrow(PathSecurityError);
      expect(() => joinFilename(testRoot, 'test/../../etc')).toThrow(
        PathSecurityError
      );
      expect(() => joinFilename(testRoot, 'test\0.txt')).toThrow(
        PathSecurityError
      );
    });

    it('should prevent absolute filenames', () => {
      expect(() => joinFilename(testRoot, '/etc/passwd')).toThrow(
        PathSecurityError
      );
      // On Windows, this would be an absolute path: C:\Windows\System32
      // On Unix, test with another absolute path
      if (process.platform === 'win32') {
        expect(() => joinFilename(testRoot, 'C:\\Windows\\System32')).toThrow(
          PathSecurityError
        );
      } else {
        expect(() => joinFilename(testRoot, '/usr/bin')).toThrow(
          PathSecurityError
        );
      }
    });
  });
});
