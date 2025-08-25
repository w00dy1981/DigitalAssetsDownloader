/**
 * ImageProcessingService - Handles all image processing operations using @napi-rs/canvas
 * Replaced Sharp with @napi-rs/canvas for better Electron compatibility
 * Zero system dependencies and pure npm packages without native compilation issues
 */

import { logger } from './LoggingService';
import { errorHandler } from './ErrorHandlingService';

// Import @napi-rs/canvas with error handling
let canvas: any = null;
try {
  canvas = require('@napi-rs/canvas');
} catch (error) {
  logger.warn(
    '@napi-rs/canvas not available, image processing disabled',
    'ImageProcessingService',
    {
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  );
}

export interface ImageProcessingOptions {
  quality?: number;
  backgroundProcessing?: {
    enabled: boolean;
    method: 'smart_detect';
    quality: number;
    edgeThreshold: number;
  };
}

export interface ImageProcessingResult {
  buffer: Buffer;
  backgroundProcessed: boolean;
  format?: string;
  width?: number;
  height?: number;
}

export interface ImageMetadata {
  format?: string;
  width?: number;
  height?: number;
  hasAlpha?: boolean;
  channels?: number;
}

/**
 * Singleton service for handling image processing operations using @napi-rs/canvas
 */
export class ImageProcessingService {
  private static instance: ImageProcessingService;
  private isCanvasAvailable: boolean = false;

  private constructor() {
    this.isCanvasAvailable = canvas !== null;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ImageProcessingService {
    if (!ImageProcessingService.instance) {
      ImageProcessingService.instance = new ImageProcessingService();
    }
    return ImageProcessingService.instance;
  }

  /**
   * Check if Canvas is available for image processing
   */
  public isProcessingAvailable(): boolean {
    return this.isCanvasAvailable;
  }

  /**
   * Get image metadata from buffer
   */
  public async getImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
    if (!this.isCanvasAvailable || !canvas) {
      logger.warn(
        'Canvas not available - cannot get image metadata',
        'ImageProcessingService'
      );
      return {};
    }

    try {
      // Create image from buffer
      const img = new canvas.Image();

      // Use Promise to handle image loading
      const metadata = await new Promise<ImageMetadata>((resolve, reject) => {
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height,
            format: this.detectImageFormat(imageBuffer),
            hasAlpha: this.detectAlphaChannel(imageBuffer),
            channels: this.detectAlphaChannel(imageBuffer) ? 4 : 3,
          });
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        // Set image source from buffer
        img.src = imageBuffer;
      });

      return metadata;
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.warn('Error getting image metadata', 'ImageProcessingService', {
        error: processedError.message,
      });
      return {};
    }
  }

  /**
   * Detect image format from buffer header
   */
  private detectImageFormat(imageBuffer: Buffer): string {
    // Check PNG signature
    if (
      imageBuffer.length >= 8 &&
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e &&
      imageBuffer[3] === 0x47
    ) {
      return 'png';
    }

    // Check JPEG signature
    if (
      imageBuffer.length >= 2 &&
      imageBuffer[0] === 0xff &&
      imageBuffer[1] === 0xd8
    ) {
      return 'jpeg';
    }

    // Check WebP signature
    if (
      imageBuffer.length >= 12 &&
      imageBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      imageBuffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'webp';
    }

    return 'unknown';
  }

  /**
   * Detect if image has alpha channel (transparency)
   */
  private detectAlphaChannel(imageBuffer: Buffer): boolean {
    const format = this.detectImageFormat(imageBuffer);

    // Only PNG and WebP can have alpha channels
    if (format === 'png') {
      // For PNG, check color type in IHDR chunk
      const ihdrStart = imageBuffer.indexOf('IHDR');
      if (ihdrStart !== -1 && ihdrStart + 17 <= imageBuffer.length) {
        // Color type is at offset 9 within IHDR data, which starts 4 bytes after 'IHDR'
        const colorType = imageBuffer[ihdrStart + 4 + 9];
        // Color types 4 and 6 have alpha channel
        return colorType === 4 || colorType === 6;
      }
    }

    if (format === 'webp') {
      // WebP VP8X format indicates alpha
      return imageBuffer.includes(Buffer.from('VP8X'));
    }

    return false;
  }

  /**
   * Smart detection for images that need background processing
   */
  public async needsBackgroundProcessing(
    imageBuffer: Buffer
  ): Promise<boolean> {
    if (!this.isCanvasAvailable || !canvas) {
      return false;
    }

    try {
      const format = this.detectImageFormat(imageBuffer);
      const hasAlpha = this.detectAlphaChannel(imageBuffer);

      // Only process PNG files with alpha channel
      if (format === 'png' && hasAlpha) {
        // For now, assume all PNG with alpha needs processing
        // In a more sophisticated implementation, we could check actual pixel transparency
        logger.info(
          'PNG with alpha channel detected - needs background processing',
          'ImageProcessingService'
        );
        return true;
      }

      return false;
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.warn(
        'Error checking image for background processing needs',
        'ImageProcessingService',
        {
          error: processedError.message,
        }
      );
      return false;
    }
  }

  /**
   * Convert image to JPEG format with white background using @napi-rs/canvas
   */
  public async convertToJpeg(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    const { quality = 95 } = options;

    if (!this.isCanvasAvailable || !canvas) {
      logger.warn(
        'Canvas not available - returning original image buffer',
        'ImageProcessingService'
      );
      return { buffer: imageBuffer, backgroundProcessed: false };
    }

    try {
      // Create image from buffer
      const img = new canvas.Image();

      // Load image and convert to JPEG
      const result = await new Promise<ImageProcessingResult>(
        (resolve, reject) => {
          img.onload = () => {
            try {
              // Create canvas with image dimensions
              const canvasElement = canvas.createCanvas(img.width, img.height);
              const ctx = canvasElement.getContext('2d');

              // Fill with white background (handles transparency)
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, img.width, img.height);

              // Draw image on top of white background
              ctx.drawImage(img, 0, 0);

              // Convert to JPEG buffer
              const jpegBuffer = canvasElement.toBuffer('image/jpeg', {
                quality: quality / 100,
              });

              const hasTransparency = this.detectAlphaChannel(imageBuffer);
              const backgroundProcessed = hasTransparency;

              if (backgroundProcessed) {
                logger.info(
                  'Image processed: transparency replaced with white background',
                  'ImageProcessingService'
                );
              }

              resolve({
                buffer: jpegBuffer,
                backgroundProcessed,
                format: 'jpeg',
                width: img.width,
                height: img.height,
              });
            } catch (error) {
              reject(error);
            }
          };

          img.onerror = () => {
            reject(new Error('Failed to load image for conversion'));
          };

          // Set image source from buffer
          img.src = imageBuffer;
        }
      );

      return result;
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.error(
        'Canvas image processing failed',
        processedError,
        'ImageProcessingService'
      );

      // Return original buffer if processing fails (no more PNG in JPEG files)
      throw new Error(`Image conversion failed: ${processedError.message}`);
    }
  }
}

/**
 * Singleton instance export
 */
export const imageProcessor = ImageProcessingService.getInstance();
