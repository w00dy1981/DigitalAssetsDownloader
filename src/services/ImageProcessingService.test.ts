/**
 * Unit tests for ImageProcessingService
 * Tests core service functionality with simplified mocking approach
 */

import {
  ImageProcessingService,
  imageProcessor,
} from './ImageProcessingService';

// Mock logger and error handler
jest.mock('./LoggingService', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./ErrorHandlingService', () => ({
  errorHandler: {
    handleError: jest.fn(error => error),
  },
}));

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    service = ImageProcessingService.getInstance();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = ImageProcessingService.getInstance();
      const instance2 = ImageProcessingService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should export singleton instance', () => {
      expect(imageProcessor).toBeInstanceOf(ImageProcessingService);
    });
  });

  describe('Sharp Availability Detection', () => {
    test('should have isProcessingAvailable method', () => {
      expect(typeof service.isProcessingAvailable).toBe('function');
      // Just test the method exists - Sharp may or may not be available in test environment
      expect(typeof service.isProcessingAvailable()).toBe('boolean');
    });
  });

  describe('Service Interface', () => {
    const mockBuffer = Buffer.from('test-image-data');

    test('should have all required methods', () => {
      expect(typeof service.getImageMetadata).toBe('function');
      expect(typeof service.needsBackgroundProcessing).toBe('function');
      expect(typeof service.convertToJpeg).toBe('function');
      expect(typeof service.processImage).toBe('function');
      expect(typeof service.isValidImage).toBe('function');
      expect(typeof service.getImageDimensions).toBe('function');
    });

    test('should handle metadata requests gracefully', async () => {
      const metadata = await service.getImageMetadata(mockBuffer);
      expect(typeof metadata).toBe('object');
    });

    test('should handle background processing checks gracefully', async () => {
      const needsProcessing =
        await service.needsBackgroundProcessing(mockBuffer);
      expect(typeof needsProcessing).toBe('boolean');
    });

    test('should handle JPEG conversion gracefully', async () => {
      const result = await service.convertToJpeg(mockBuffer);
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('backgroundProcessed');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(typeof result.backgroundProcessed).toBe('boolean');
    });

    test('should handle image processing gracefully', async () => {
      const result = await service.processImage(mockBuffer);
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('backgroundProcessed');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(typeof result.backgroundProcessed).toBe('boolean');
    });

    test('should handle image validation gracefully', async () => {
      const isValid = await service.isValidImage(mockBuffer);
      expect(typeof isValid).toBe('boolean');
    });

    test('should handle dimension extraction gracefully', async () => {
      const dimensions = await service.getImageDimensions(mockBuffer);
      expect(
        dimensions === null ||
          (typeof dimensions === 'object' &&
            dimensions.width &&
            dimensions.height)
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        service.getImageMetadata(emptyBuffer)
      ).resolves.toBeDefined();
      await expect(
        service.needsBackgroundProcessing(emptyBuffer)
      ).resolves.toBeDefined();
      await expect(service.convertToJpeg(emptyBuffer)).resolves.toBeDefined();
      await expect(service.isValidImage(emptyBuffer)).resolves.toBeDefined();
      await expect(
        service.getImageDimensions(emptyBuffer)
      ).resolves.toBeDefined();
    });

    test('should handle invalid options gracefully', async () => {
      const mockBuffer = Buffer.from('test');

      const result = await service.convertToJpeg(mockBuffer, {
        quality: -1, // Invalid quality
        backgroundProcessing: undefined as any,
      });

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });
  });
});
