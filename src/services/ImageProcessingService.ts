/**
 * ImageProcessingService - Handles all image processing operations using Jimp
 * Replaced @napi-rs/canvas with Jimp for better Electron reliability
 * Pure JavaScript implementation with zero native dependencies
 */

import { Jimp } from 'jimp';
import { logger } from './LoggingService';
import { errorHandler } from './ErrorHandlingService';
import { CONSTANTS } from '@/shared/constants';

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
 * Singleton service for handling image processing operations using Jimp
 */
export class ImageProcessingService {
  private static instance: ImageProcessingService;

  private constructor() {}

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
   * Check if image processing is available (always true with Jimp)
   */
  public isProcessingAvailable(): boolean {
    return true;
  }

  /**
   * Get image metadata from buffer
   */
  public async getImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
    try {
      const image = await Jimp.fromBuffer(imageBuffer);
      const format = this.detectImageFormat(imageBuffer);
      const hasAlpha = this.detectAlphaChannel(imageBuffer);

      return {
        width: image.width,
        height: image.height,
        format,
        hasAlpha,
        channels: hasAlpha ? 4 : 3,
      };
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
   * Simple detection for images that need background processing
   * Convert ALL PNG and WebP files to JPEG when background processing is enabled
   */
  public async needsBackgroundProcessing(
    imageBuffer: Buffer
  ): Promise<boolean> {
    try {
      const format = this.detectImageFormat(imageBuffer);

      // Process ALL PNG and WebP files (user wants them converted to JPEG)
      if (format === 'png' || format === 'webp') {
        logger.info(
          `${format.toUpperCase()} file detected - applying background processing`,
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
   * Check if a Jimp image has transparent pixels by scanning the alpha channel
   */
  private hasTransparentPixels(image: any): boolean {
    const { width, height } = image;

    // Sample pixels to check for transparency (check every 10th pixel for performance)
    const sampleSize = Math.max(1, Math.floor(Math.min(width, height) / 10));

    for (let y = 0; y < height; y += sampleSize) {
      for (let x = 0; x < width; x += sampleSize) {
        const rgba = image.getPixelColour
          ? image.getPixelColour(x, y)
          : image.getPixelColor(x, y);
        const alpha = rgba & 0xff; // Extract alpha channel (last 8 bits)

        if (alpha < 255) {
          // Found a pixel with transparency
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Convert image to JPEG format with white background using Jimp
   */
  public async convertToJpeg(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    const { quality = CONSTANTS.IMAGE.DEFAULT_QUALITY } = options;

    try {
      // Load image with Jimp
      const image = await Jimp.fromBuffer(imageBuffer);
      const originalWidth = image.width;
      const originalHeight = image.height;

      // Detect if image has transparency using Jimp pixel analysis
      const hasTransparency = this.hasTransparentPixels(image);

      let processedImage = image;

      // If image has transparency, create white background
      if (hasTransparency) {
        // Create white background image
        const whiteBackground = new Jimp({
          width: originalWidth,
          height: originalHeight,
          color: 0xffffffff,
        });

        // Composite the original image over the white background
        processedImage = whiteBackground.composite(image, 0, 0);

        logger.info(
          'Image processed: transparency replaced with white background',
          'ImageProcessingService'
        );
      }

      // Convert to JPEG with specified quality
      const jpegBuffer = await processedImage.getBuffer('image/jpeg', {
        quality,
      });

      return {
        buffer: jpegBuffer,
        backgroundProcessed: hasTransparency,
        format: 'jpeg',
        width: originalWidth,
        height: originalHeight,
      };
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.error(
        'Jimp image processing failed',
        processedError,
        'ImageProcessingService'
      );

      // Throw error instead of returning original buffer (better error visibility)
      throw new Error(`Image conversion failed: ${processedError.message}`);
    }
  }
}

/**
 * Singleton instance export
 */
export const imageProcessor = ImageProcessingService.getInstance();
