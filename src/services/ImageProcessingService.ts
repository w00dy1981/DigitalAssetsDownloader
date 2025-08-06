/**
 * ImageProcessingService - Handles all image processing operations
 * Extracted from downloadService.ts for better separation of concerns
 * Follows KISS/DRY principles with focused single responsibility
 */

import { logger } from './LoggingService';
import { errorHandler } from './ErrorHandlingService';

// Import Sharp with error handling
let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharp = require('sharp');
} catch (error) {
  logger.warn(
    'Sharp not available, image processing disabled',
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
    method: 'smart_detect' | 'ai_removal' | 'color_replace' | 'edge_detection';
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
 * Singleton service for handling image processing operations
 */
export class ImageProcessingService {
  private static instance: ImageProcessingService;
  private isSharpAvailable: boolean = false;

  private constructor() {
    this.isSharpAvailable = sharp !== null;
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
   * Check if Sharp is available for image processing
   */
  public isProcessingAvailable(): boolean {
    return this.isSharpAvailable;
  }

  /**
   * Get image metadata without processing
   */
  public async getImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
    if (!this.isSharpAvailable || !sharp) {
      logger.warn(
        'Sharp not available - cannot get image metadata',
        'ImageProcessingService'
      );
      return {};
    }

    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
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
   * Smart detection for images that need background processing
   * Only processes PNG files with actual transparency
   */
  public async needsBackgroundProcessing(
    imageBuffer: Buffer
  ): Promise<boolean> {
    if (!this.isSharpAvailable || !sharp) {
      return false;
    }

    try {
      const metadata = await sharp(imageBuffer).metadata();

      // Only process PNG files with actual transparency
      if (metadata.format === 'png' && metadata.hasAlpha) {
        // Sample a small region to check for transparency (performance optimization)
        const sampleSize = 100; // Sample 100x100 pixels max
        const { data } = await sharp(imageBuffer)
          .resize(
            Math.min(metadata.width || sampleSize, sampleSize),
            Math.min(metadata.height || sampleSize, sampleSize)
          )
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Check every 10th alpha pixel for efficiency
        for (let i = 3; i < data.length; i += 40) {
          // Sample every 10th pixel's alpha
          if (data[i] < 255) {
            logger.info(
              'Found transparency in PNG - needs background processing',
              'ImageProcessingService'
            );
            return true;
          }
        }

        logger.info(
          'PNG has alpha channel but no actual transparency - skipping processing',
          'ImageProcessingService'
        );
        return false;
      }

      // Skip all other formats (JPEG, etc.) - they don't have transparency
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
   * Convert image to JPEG format with optional background processing
   */
  public async convertToJpeg(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    const { quality = 95, backgroundProcessing } = options;

    if (!this.isSharpAvailable || !sharp) {
      logger.warn(
        'Sharp not available - returning original image buffer',
        'ImageProcessingService'
      );
      return { buffer: imageBuffer, backgroundProcessed: false };
    }

    // Check if background processing is enabled
    const backgroundProcessingEnabled = backgroundProcessing?.enabled ?? false;

    try {
      const needsProcessing =
        backgroundProcessingEnabled &&
        (await this.needsBackgroundProcessing(imageBuffer));

      if (needsProcessing) {
        // Apply white background to handle transparency
        const processedBuffer = await sharp(imageBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background
          .jpeg({ quality })
          .toBuffer();

        logger.info(
          'Image processed: transparency replaced with white background',
          'ImageProcessingService'
        );
        return {
          buffer: processedBuffer,
          backgroundProcessed: true,
          format: 'jpeg',
        };
      } else {
        // Just convert to JPEG without background processing
        const processedBuffer = await sharp(imageBuffer)
          .jpeg({ quality })
          .toBuffer();

        return {
          buffer: processedBuffer,
          backgroundProcessed: false,
          format: 'jpeg',
        };
      }
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.error(
        'Sharp image processing failed',
        processedError,
        'ImageProcessingService'
      );

      // Return original buffer if processing fails
      return { buffer: imageBuffer, backgroundProcessed: false };
    }
  }

  /**
   * Process image with comprehensive options and metadata extraction
   */
  public async processImage(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    try {
      // Get metadata first
      const metadata = await this.getImageMetadata(imageBuffer);

      // Convert to JPEG with processing
      const result = await this.convertToJpeg(imageBuffer, options);

      // Merge metadata into result
      return {
        ...result,
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.error(
        'Image processing failed',
        processedError,
        'ImageProcessingService'
      );

      return { buffer: imageBuffer, backgroundProcessed: false };
    }
  }

  /**
   * Check if a buffer contains image data
   */
  public async isValidImage(buffer: Buffer): Promise<boolean> {
    if (!this.isSharpAvailable || !sharp) {
      return false;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      return !!(metadata.format && metadata.width && metadata.height);
    } catch {
      return false;
    }
  }

  /**
   * Get image dimensions without full processing
   */
  public async getImageDimensions(
    buffer: Buffer
  ): Promise<{ width: number; height: number } | null> {
    if (!this.isSharpAvailable || !sharp) {
      return null;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      if (metadata.width && metadata.height) {
        return { width: metadata.width, height: metadata.height };
      }
      return null;
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'ImageProcessingService',
        { throwOnError: false }
      );
      logger.warn('Error getting image dimensions', 'ImageProcessingService', {
        error: processedError.message,
      });
      return null;
    }
  }
}

// Export singleton instance
export const imageProcessor = ImageProcessingService.getInstance();
