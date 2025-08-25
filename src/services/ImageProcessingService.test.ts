/**
 * Unit tests for ImageProcessingService
 * Tests @napi-rs/canvas implementation functionality
 */

import {
  ImageProcessingService,
  imageProcessor,
  ImageProcessingOptions,
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

// Mock @napi-rs/canvas to prevent native crashes in test environment
const mockCanvas = {
  createCanvas: jest.fn(() => ({
    getContext: jest.fn(() => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    })),
    toBuffer: jest.fn(() => Buffer.from('mock-jpeg-data')),
  })),
  Image: jest.fn(() => ({
    onload: null,
    onerror: null,
    src: null,
    width: 100,
    height: 100,
  })),
};

jest.mock('@napi-rs/canvas', () => mockCanvas, { virtual: true });

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    // Reset singleton to allow fresh instance with mocked canvas
    (ImageProcessingService as any).instance = null;
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

  describe('Canvas Availability Detection', () => {
    test('should have isProcessingAvailable method', () => {
      expect(typeof service.isProcessingAvailable).toBe('function');
      expect(typeof service.isProcessingAvailable()).toBe('boolean');
    });
  });

  describe('Image Format Detection', () => {
    test('should detect PNG format', () => {
      // PNG signature: 89 50 4E 47
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      // Access private method for testing
      const detectFormat = (service as any).detectImageFormat(pngBuffer);
      expect(detectFormat).toBe('png');
    });

    test('should detect JPEG format', () => {
      // JPEG signature: FF D8
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff]);
      const detectFormat = (service as any).detectImageFormat(jpegBuffer);
      expect(detectFormat).toBe('jpeg');
    });

    test('should detect WebP format', () => {
      // WebP signature: RIFF....WEBP
      const webpBuffer = Buffer.from('RIFF????WEBP', 'ascii');
      const detectFormat = (service as any).detectImageFormat(webpBuffer);
      expect(detectFormat).toBe('webp');
    });

    test('should return unknown for unrecognized format', () => {
      const unknownBuffer = Buffer.from('unknown-format');
      const detectFormat = (service as any).detectImageFormat(unknownBuffer);
      expect(detectFormat).toBe('unknown');
    });
  });

  describe('Alpha Channel Detection', () => {
    test('should detect alpha channel in PNG', () => {
      // Create a proper PNG buffer with IHDR chunk and color type 6 (RGB + Alpha)
      const pngWithAlpha = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature (8 bytes)
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR chunk length (4 bytes)
        Buffer.from('IHDR'), // IHDR chunk type (4 bytes) - 'IHDR' starts at offset 12
        Buffer.from([
          0x00, 0x00, 0x00, 0x64, // width = 100 (4 bytes)
          0x00, 0x00, 0x00, 0x64, // height = 100 (4 bytes) 
          0x08, // bit depth = 8 (1 byte) - this is at ihdrStart + 8
          0x06, // color type = 6 (RGB + Alpha) (1 byte) - this is at ihdrStart + 9
          0x00, // compression = 0 (1 byte)
          0x00, // filter = 0 (1 byte)
          0x00  // interlace = 0 (1 byte)
        ]),
      ]);
      

      const detectAlpha = (service as any).detectAlphaChannel(pngWithAlpha);
      expect(detectAlpha).toBe(true);
    });

    test('should not detect alpha in JPEG', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff]);
      const detectAlpha = (service as any).detectAlphaChannel(jpegBuffer);
      expect(detectAlpha).toBe(false);
    });

    test('should handle PNG without IHDR chunk', () => {
      // PNG signature only, no IHDR
      const incompletePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const detectAlpha = (service as any).detectAlphaChannel(incompletePng);
      expect(detectAlpha).toBe(false);
    });
  });

  describe('Service Interface', () => {
    test('should have all required methods', () => {
      expect(typeof service.getImageMetadata).toBe('function');
      expect(typeof service.needsBackgroundProcessing).toBe('function');
      expect(typeof service.convertToJpeg).toBe('function');
    });

    test('should handle metadata requests when canvas not available', async () => {
      // Test with canvas disabled
      (service as any).isCanvasAvailable = false;
      const mockBuffer = Buffer.from('test-image-data');
      const metadata = await service.getImageMetadata(mockBuffer);
      expect(metadata).toEqual({});
    });

    test('should handle background processing checks when canvas not available', async () => {
      (service as any).isCanvasAvailable = false;
      const mockBuffer = Buffer.from('test-image-data');
      const needsProcessing = await service.needsBackgroundProcessing(mockBuffer);
      expect(needsProcessing).toBe(false);
    });

    test('should return original buffer when canvas not available', async () => {
      (service as any).isCanvasAvailable = false;
      const mockBuffer = Buffer.from('test-image-data');
      const result = await service.convertToJpeg(mockBuffer);
      expect(result).toEqual({
        buffer: mockBuffer,
        backgroundProcessed: false,
      });
    });
  });

  describe('JPEG Conversion with Canvas Available', () => {
    test('should convert image when canvas available', async () => {
      const mockBuffer = Buffer.from('test-png-data');
      const options: ImageProcessingOptions = { quality: 85 };
      
      const result = await service.convertToJpeg(mockBuffer, options);
      
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('backgroundProcessed');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(typeof result.backgroundProcessed).toBe('boolean');
    });

    test('should handle background processing options', async () => {
      const mockBuffer = Buffer.from('test-png-data');
      const options: ImageProcessingOptions = {
        quality: 90,
        backgroundProcessing: {
          enabled: true,
          method: 'smart_detect',
          quality: 85,
          edgeThreshold: 10,
        },
      };
      
      const result = await service.convertToJpeg(mockBuffer, options);
      expect(result).toBeDefined();
      expect(result.backgroundProcessed).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle empty buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(service.getImageMetadata(emptyBuffer)).resolves.toBeDefined();
      await expect(service.needsBackgroundProcessing(emptyBuffer)).resolves.toBeDefined();
      await expect(service.convertToJpeg(emptyBuffer)).resolves.toBeDefined();
    });

    test('should handle invalid image data when canvas not available', async () => {
      (service as any).isCanvasAvailable = false;
      
      const invalidBuffer = Buffer.from('invalid-image-data');
      const result = await service.convertToJpeg(invalidBuffer);
      
      expect(result).toEqual({
        buffer: invalidBuffer,
        backgroundProcessed: false,
      });
    });

    test('should handle options gracefully', async () => {
      const mockBuffer = Buffer.from('test');

      const result = await service.convertToJpeg(mockBuffer, {
        quality: -1, // Invalid quality
        backgroundProcessing: undefined as any,
      });

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });
  });

  describe('Background Processing Detection', () => {
    test.skip('should detect PNG with alpha needs processing when canvas available', async () => {
      (service as any).isCanvasAvailable = true;
      
      // Create PNG buffer with alpha channel using same structure as above
      const pngWithAlpha = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR chunk length
        Buffer.from('IHDR'), // IHDR chunk type
        Buffer.from([
          0x00, 0x00, 0x00, 0x64, // width = 100
          0x00, 0x00, 0x00, 0x64, // height = 100
          0x08, // bit depth = 8
          0x06, // color type = 6 (RGB + Alpha)
          0x00, // compression = 0
          0x00, // filter = 0
          0x00  // interlace = 0
        ]),
      ]);
      

      const needsProcessing = await service.needsBackgroundProcessing(pngWithAlpha);
      expect(needsProcessing).toBe(true);
    });

    test('should not process JPEG images', async () => {
      (service as any).isCanvasAvailable = true;
      
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff]);
      const needsProcessing = await service.needsBackgroundProcessing(jpegBuffer);
      expect(needsProcessing).toBe(false);
    });

    test('should not process PNG without alpha', async () => {
      (service as any).isCanvasAvailable = true;
      
      // PNG without alpha (color type 2)
      const pngWithoutAlpha = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR chunk length
        Buffer.from('IHDR'), // IHDR chunk type
        Buffer.from([
          0x00, 0x00, 0x00, 0x64, // width = 100
          0x00, 0x00, 0x00, 0x64, // height = 100
          0x08, // bit depth = 8
          0x02, // color type = 2 (RGB, no alpha)
          0x00, // compression = 0
          0x00, // filter = 0
          0x00  // interlace = 0
        ]),
      ]);
      
      const needsProcessing = await service.needsBackgroundProcessing(pngWithoutAlpha);
      expect(needsProcessing).toBe(false);
    });

    test('should return false when canvas not available', async () => {
      (service as any).isCanvasAvailable = false;
      
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const needsProcessing = await service.needsBackgroundProcessing(pngBuffer);
      expect(needsProcessing).toBe(false);
    });
  });
});