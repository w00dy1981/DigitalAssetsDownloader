import * as fs from 'fs/promises';
import * as path from 'path';
import axios, { AxiosResponse } from 'axios';
import {
  DownloadConfig,
  DownloadItem,
  DownloadResult,
  DownloadProgress,
} from '@/shared/types';
import { EventEmitter } from 'events';
import {
  sanitizePath,
  safeJoin,
  safeReadDir,
  PathSecurityError,
  validateFileAccess,
} from './pathSecurity';
import { isImageFile } from './fileUtils';
import { logger } from './LoggingService';
import { errorHandler } from './ErrorHandlingService';
// import { withErrorHandling } from '@/utils/withErrorHandling'; // Available for future use
import { imageProcessor } from './ImageProcessingService';
import { appConstants } from './AppConstantsService';

interface DownloadJobItem extends DownloadItem {
  imageFilePaths: string[];
  pdfFilePath?: string;
  networkImagePaths: string[];
  networkPdfPath?: string;
}

export class DownloadService extends EventEmitter {
  private isDownloading = false;
  private cancelled = false;
  private startTime = 0;
  private currentAbortController: AbortController | null = null;
  private operationLock: Promise<void> | null = null;
  private pendingOperations: Array<{
    type: 'start' | 'cancel';
    resolve: () => void;
    reject: (reason?: any) => void;
  }> = [];
  private progress: DownloadProgress = {
    currentFile: '',
    successful: 0,
    failed: 0,
    total: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    backgroundProcessed: 0,
  };

  constructor() {
    super();
  }

  /**
   * Sanitize filename by removing non-alphanumeric characters except underscores
   * Matches Python implementation (Line 312)
   */
  private sanitizeFilename(name: string): string {
    const nameStr = String(name);
    // Replace whitespace with underscores
    let sanitized = nameStr.replace(/\s+/g, '_');
    // Keep only alphanumeric characters and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');
    return sanitized;
  }

  /**
   * Convert image to JPEG format using ImageProcessingService
   */
  private async convertToJpg(
    imageBuffer: Buffer,
    quality = appConstants.getDefaultQuality(),
    config?: DownloadConfig
  ): Promise<{ buffer: Buffer; backgroundProcessed: boolean }> {
    // Check for cancellation before processing
    if (this.cancelled || this.currentAbortController?.signal.aborted) {
      throw new Error('Image processing cancelled');
    }

    try {
      const result = await imageProcessor.convertToJpeg(imageBuffer, {
        quality,
        backgroundProcessing: config?.backgroundProcessing,
      });

      return {
        buffer: result.buffer,
        backgroundProcessed: result.backgroundProcessed,
      };
    } catch (error) {
      // Using withErrorHandling utility would simplify this pattern:
      // const result = await withErrorHandling(
      //   () => imageProcessor.processImage(imageBuffer, config),
      //   'ImageProcessing',
      //   { returnNullOnError: true }
      // );
      // if (!result) return { buffer: imageBuffer, backgroundProcessed: false };

      const processedError = errorHandler.handleError(
        error,
        'DownloadService',
        { throwOnError: false }
      );
      logger.error(
        'Advanced image processing failed, attempting basic PNG to JPEG conversion',
        processedError,
        'DownloadService'
      );

      // With @napi-rs/canvas, we don't need a fallback - throw error to fail download properly
      throw new Error(
        `Cannot convert PNG to JPEG - image processing failed: ${processedError.message}`
      );
    }
  }

  /**
   * Write processed content to file with directory creation
   * Extracted method for better separation of concerns
   */
  private async writeProcessedFile(
    content: Buffer,
    filepath: string
  ): Promise<void> {
    // Check for cancellation before file write
    if (this.cancelled || this.currentAbortController?.signal.aborted) {
      throw new Error('File write cancelled');
    }

    // Example of withErrorHandling utility usage:
    // await withErrorHandling(async () => {
    //   await fs.mkdir(path.dirname(filepath), { recursive: true });
    //   await fs.writeFile(filepath, content);
    // }, 'FileWrite');

    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, content);
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'DownloadService',
        { throwOnError: false }
      );
      throw processedError;
    }
  }

  /**
   * Search for files in source folder matching part number or filename
   * Matches Python implementation (Lines 340-362)
   */
  private async searchSourceFolder(
    sourceFolder: string,
    partNo: string,
    specificFilename?: string
  ): Promise<string | null> {
    try {
      // Sanitize the source folder path
      const safeSourceFolder = sanitizePath(sourceFolder);

      const stats = await fs.stat(safeSourceFolder);
      if (!stats.isDirectory()) {
        return null;
      }

      // Use secure directory reading
      const filePaths = await safeReadDir(safeSourceFolder, safeSourceFolder);
      const matchingFiles: string[] = [];

      // First try to match specific filename if provided
      if (specificFilename) {
        const cleanFilename = specificFilename.toLowerCase();
        for (const filePath of filePaths) {
          const fileName = path.basename(filePath);
          if (fileName.toLowerCase().includes(cleanFilename)) {
            // Validate file access before adding to matches
            if (await validateFileAccess(filePath, safeSourceFolder)) {
              matchingFiles.push(filePath);
            }
          }
        }
      }

      // If no matches with specific filename, try part number
      if (matchingFiles.length === 0 && partNo) {
        const cleanPartNo = String(partNo).trim().toLowerCase();
        for (const filePath of filePaths) {
          const fileName = path.basename(filePath);
          if (fileName.toLowerCase().includes(cleanPartNo)) {
            // Validate file access before adding to matches
            if (await validateFileAccess(filePath, safeSourceFolder)) {
              matchingFiles.push(filePath);
            }
          }
        }
      }

      return matchingFiles.length > 0 ? matchingFiles[0] : null;
    } catch (error) {
      if (error instanceof PathSecurityError) {
        logger.error(
          'Security violation in source folder search',
          error,
          'DownloadService'
        );
        return null;
      }
      const processedError = errorHandler.handleError(
        error,
        'DownloadService',
        { throwOnError: false }
      );
      logger.error(
        'Error searching source folder',
        processedError,
        'DownloadService'
      );
      return null;
    }
  }

  /**
   * Check source folder for matching files and return file path if found
   * Extracted method for better separation of concerns
   */
  private async checkSourceFolder(
    partNo: string,
    sourceFolder?: string,
    specificFilename?: string
  ): Promise<{ filePath: string; content: Buffer } | null> {
    if (!sourceFolder) {
      return null;
    }

    try {
      const sourceFile = await this.searchSourceFolder(
        sourceFolder,
        partNo,
        specificFilename
      );
      if (!sourceFile) {
        return null;
      }

      const content = await fs.readFile(sourceFile);
      return { filePath: sourceFile, content };
    } catch (error) {
      const processedError = errorHandler.handleError(
        error,
        'DownloadService',
        { throwOnError: false }
      );
      logger.error(
        'Error accessing source folder',
        processedError,
        'DownloadService'
      );
      return null;
    }
  }

  /**
   * Handle local file processing (both file and directory paths)
   * Extracted method for better separation of concerns
   */
  private async handleLocalFile(
    url: string,
    config?: DownloadConfig
  ): Promise<{
    success: boolean;
    content?: Buffer;
    backgroundProcessed?: boolean;
    message?: string;
  } | null> {
    try {
      // Sanitize the URL as a potential file path
      const safeUrl = sanitizePath(url);
      const urlStat = await fs.stat(safeUrl);

      if (urlStat.isFile()) {
        const content = await fs.readFile(safeUrl);

        // Process image if it's an image file
        let processedContent = content;
        let backgroundProcessed = false;

        const isImageFile = /\.(jpg|jpeg|png|gif|bmp)$/i.test(url);
        if (isImageFile) {
          try {
            const result = await this.convertToJpg(content, appConstants.getDefaultQuality(), config);
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            logger.warn(
              'Image processing failed for local file',
              'DownloadService',
              { url, error }
            );
          }
        }

        return {
          success: true,
          content: processedContent,
          backgroundProcessed,
          message: 'File copied and processed successfully',
        };
      }

      if (urlStat.isDirectory()) {
        // Handle local directory - look for image files
        const filePaths = await safeReadDir(safeUrl, safeUrl);

        const imageFiles = filePaths.filter(filePath =>
          isImageFile(path.basename(filePath))
        );

        if (imageFiles.length > 0) {
          const sourceFile = imageFiles[0]; // Already a safe path from safeReadDir
          const content = await fs.readFile(sourceFile);

          let processedContent = content;
          let backgroundProcessed = false;

          try {
            const result = await this.convertToJpg(content, appConstants.getDefaultQuality(), config);
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            logger.warn(
              'Image processing failed for directory file',
              'DownloadService',
              { sourceFile, error }
            );
          }

          return {
            success: true,
            content: processedContent,
            backgroundProcessed,
            message: `File copied and processed from directory (${imageFiles.length} images found)`,
          };
        } else {
          return {
            success: false,
            message: 'No image files found in directory',
          };
        }
      }

      return null; // Not a file or directory
    } catch {
      // Not a local file/directory, return null to continue with HTTP download
      return null;
    }
  }

  /**
   * Perform HTTP download with retry logic
   * Extracted method for better separation of concerns
   */
  private async downloadFromHttp(
    url: string,
    retryCount = 3,
    config?: DownloadConfig,
    abortSignal?: AbortSignal
  ): Promise<{
    success: boolean;
    content?: Buffer;
    contentType?: string;
    httpStatus?: number;
    message?: string;
    backgroundProcessed?: boolean;
  }> {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    for (let attempt = 0; attempt < retryCount; attempt++) {
      if (this.cancelled || abortSignal?.aborted) {
        return { success: false, message: 'Download cancelled' };
      }

      try {
        const response: AxiosResponse = await axios({
          method: 'GET',
          url,
          headers,
          timeout: 60000, // 60 second timeout- up from 30
          responseType: 'arraybuffer',
          signal: abortSignal,
        });

        const content = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || '';

        // Process images to JPG format
        let processedContent = content;
        let backgroundProcessed = false;

        if (this.isImageContent(url, contentType, content)) {
          try {
            const result = await this.convertToJpg(content, appConstants.getDefaultQuality(), config);
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            if (attempt === retryCount - 1) {
              return {
                success: false,
                httpStatus: response.status,
                contentType,
                message: `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              };
            }
            continue; // Retry if not last attempt
          }
        }

        return {
          success: true,
          content: processedContent,
          contentType,
          httpStatus: response.status,
          backgroundProcessed,
          message: 'Success',
        };
      } catch (error) {
        if (attempt === retryCount - 1) {
          // Last attempt failed
          if (axios.isAxiosError(error)) {
            return {
              success: false,
              httpStatus: error.response?.status || 0,
              message:
                error.code === 'ECONNABORTED' ? 'Timeout error' : error.message,
            };
          } else {
            return {
              success: false,
              message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        }

        // Exponential backoff delay
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    return {
      success: false,
      message: 'Download failed after all retry attempts',
    };
  }

  /**
   * Enhanced image detection using URL extension, Content-Type, and magic bytes
   * This addresses the issue where servers return wrong Content-Type headers
   */
  private isImageContent(
    url: string,
    contentType: string,
    buffer: Buffer
  ): boolean {
    // Method 1: Check URL extension
    const urlExtension = url
      .toLowerCase()
      .match(/\.(jpg|jpeg|png|gif|bmp|webp)(?:\?.*)?$/i);
    if (urlExtension) {
      logger.info(
        `Image detected by URL extension: ${urlExtension[1]}`,
        'DownloadService',
        { url: url.substring(0, 100) + '...' }
      );
      return true;
    }

    // Method 2: Check Content-Type header (original method)
    if (contentType.startsWith('image/')) {
      logger.info(
        `Image detected by Content-Type: ${contentType}`,
        'DownloadService'
      );
      return true;
    }

    // Method 3: Check magic bytes (buffer signature)
    if (buffer.length < 12) return false;

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      logger.info('Image detected by PNG magic bytes', 'DownloadService');
      return true;
    }

    // JPEG signature: FF D8
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      logger.info('Image detected by JPEG magic bytes', 'DownloadService');
      return true;
    }

    // WebP signature: RIFF....WEBP
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      logger.info('Image detected by WebP magic bytes', 'DownloadService');
      return true;
    }

    // GIF signatures: GIF87a or GIF89a
    const gifSignature = buffer.subarray(0, 6).toString('ascii');
    if (gifSignature === 'GIF87a' || gifSignature === 'GIF89a') {
      logger.info('Image detected by GIF magic bytes', 'DownloadService');
      return true;
    }

    logger.debug('Content not detected as image', 'DownloadService', {
      url: url.substring(0, 100) + '...',
      contentType,
      firstBytes: buffer.subarray(0, 12).toString('hex'),
    });
    return false;
  }

  /**
   * Download file with comprehensive error handling and retry logic
   * Refactored to use extracted methods for better separation of concerns
   * Matches Python implementation (Lines 380-580)
   */
  private async downloadFile(
    url: string,
    filepath: string,
    retryCount = 3,
    partNo?: string,
    sourceFolder?: string,
    specificFilename?: string,
    config?: DownloadConfig,
    abortSignal?: AbortSignal
  ): Promise<DownloadResult> {
    // Create download result object
    const createResult = (
      success: boolean,
      httpStatus = 0,
      contentType = '',
      fileSize = 0,
      message = '',
      backgroundProcessed = false
    ): DownloadResult => ({
      success,
      url,
      filePath: filepath,
      networkPath: filepath, // Will be updated with network path later
      httpStatus,
      contentType,
      fileSize,
      error: success ? undefined : message,
      backgroundProcessed,
    });

    // Check for abort signal
    if (abortSignal?.aborted || this.cancelled) {
      return createResult(false, 0, '', 0, 'Download cancelled');
    }

    // Step 1: Check source folder first
    const sourceResult = await this.checkSourceFolder(
      partNo || '',
      sourceFolder,
      specificFilename
    );
    if (sourceResult) {
      try {
        // Process image if it's an image file
        let processedContent = sourceResult.content;
        let backgroundProcessed = false;

        const isImageFile = /\.(jpg|jpeg|png|gif|bmp)$/i.test(
          sourceResult.filePath
        );
        if (isImageFile) {
          try {
            const result = await this.convertToJpg(
              sourceResult.content,
              appConstants.getDefaultQuality(),
              config
            );
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            logger.warn(
              `Image processing failed for ${sourceResult.filePath}`,
              'DownloadService',
              { error }
            );
          }
        }

        await this.writeProcessedFile(processedContent, filepath);

        return createResult(
          true,
          200,
          'local_file_processed',
          processedContent.length,
          'File copied and processed from source folder',
          backgroundProcessed
        );
      } catch (error) {
        return createResult(
          false,
          0,
          '',
          0,
          `Error processing source folder file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Step 2: Check if URL is a local file path
    const localResult = await this.handleLocalFile(url, config);
    if (localResult) {
      if (!localResult.success) {
        return createResult(
          false,
          0,
          '',
          0,
          localResult.message || 'Local file processing failed'
        );
      }

      try {
        await this.writeProcessedFile(localResult.content!, filepath);

        return createResult(
          true,
          200,
          'local_file_processed',
          localResult.content!.length,
          localResult.message || 'File processed successfully',
          localResult.backgroundProcessed || false
        );
      } catch (error) {
        return createResult(
          false,
          0,
          '',
          0,
          `Error writing local file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Step 3: HTTP download with retry logic
    const httpResult = await this.downloadFromHttp(
      url,
      retryCount,
      config,
      abortSignal
    );
    if (!httpResult.success) {
      return createResult(
        false,
        httpResult.httpStatus || 0,
        httpResult.contentType || '',
        0,
        httpResult.message || 'HTTP download failed'
      );
    }

    // Step 4: Write the downloaded content
    try {
      await this.writeProcessedFile(httpResult.content!, filepath);

      return createResult(
        true,
        httpResult.httpStatus || 200,
        httpResult.contentType || '',
        httpResult.content!.length,
        httpResult.message || 'Success',
        httpResult.backgroundProcessed || false
      );
    } catch (error) {
      return createResult(
        false,
        httpResult.httpStatus || 0,
        httpResult.contentType || '',
        0,
        `Error writing downloaded file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update progress and emit progress event
   */
  private updateProgress(update: Partial<DownloadProgress>): void {
    this.progress = { ...this.progress, ...update };

    // Calculate elapsed time
    if (this.startTime > 0) {
      this.progress.elapsedTime = Math.floor(
        (Date.now() - this.startTime) / 1000
      );
    }

    // Calculate percentage
    if (this.progress.total > 0) {
      this.progress.percentage =
        ((this.progress.successful + this.progress.failed) /
          this.progress.total) *
        100;
    }

    // Calculate estimated time remaining
    if (this.progress.percentage > 0 && this.progress.percentage < 100) {
      const totalEstimatedTime =
        (this.progress.elapsedTime * 100) / this.progress.percentage;
      this.progress.estimatedTimeRemaining = Math.max(
        0,
        Math.floor(totalEstimatedTime - this.progress.elapsedTime)
      );
    } else {
      this.progress.estimatedTimeRemaining = 0;
    }

    console.log('Emitting progress:', this.progress); // Debug log
    this.emit('progress', this.progress);
  }

  /**
   * Prepare download items from configuration and spreadsheet data
   */
  private async prepareDownloadItems(
    config: DownloadConfig,
    data: any[]
  ): Promise<DownloadJobItem[]> {
    const items: DownloadJobItem[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1;
      const partNumber = row[config.partNoColumn];

      if (!partNumber) continue; // Skip rows without part numbers

      const sanitizedPartNo = this.sanitizeFilename(String(partNumber));
      const customFilename = config.filenameColumn
        ? row[config.filenameColumn]
        : undefined;

      // Prepare image downloads
      const imageFilePaths: string[] = [];
      const networkImagePaths: string[] = [];
      const urls: string[] = [];

      for (const column of config.imageColumns) {
        const url = row[column];
        if (url) {
          urls.push(String(url));
          const filename = `${sanitizedPartNo}.jpg`;
          const localPath = safeJoin(config.imageFolder, filename);
          const imageNetworkPath = config.imageFilePath?.trim() || '';
          const networkPath = imageNetworkPath
            ? safeJoin(imageNetworkPath, filename)
            : '';

          imageFilePaths.push(localPath);
          networkImagePaths.push(networkPath);
        }
      }

      // Prepare PDF download
      let pdfFilePath: string | undefined;
      let networkPdfPath: string | undefined;

      if (config.pdfColumn && row[config.pdfColumn]) {
        const pdfFilename = `${sanitizedPartNo}.pdf`;
        pdfFilePath = safeJoin(config.pdfFolder, pdfFilename);
        const pdfNetworkPath = config.pdfFilePath?.trim() || '';
        networkPdfPath = pdfNetworkPath
          ? safeJoin(pdfNetworkPath, pdfFilename)
          : '';

        if (urls.length === 0) {
          urls.push(String(row[config.pdfColumn]));
        }
      }

      if (urls.length > 0 || imageFilePaths.length > 0 || pdfFilePath) {
        items.push({
          rowNumber,
          partNumber: String(partNumber),
          urls,
          pdfUrl: config.pdfColumn ? row[config.pdfColumn] : undefined,
          customFilename,
          sourceFolder: config.sourceImageFolder,
          imageFilePaths,
          pdfFilePath,
          networkImagePaths,
          networkPdfPath,
        });
      }
    }

    return items;
  }

  /**
   * Acquire operation lock to prevent concurrent operations
   */
  private async acquireOperationLock(): Promise<() => void> {
    while (this.operationLock) {
      await this.operationLock;
    }

    let lockResolve: (() => void) | undefined;
    this.operationLock = new Promise<void>(resolve => {
      lockResolve = resolve;
    });

    return lockResolve!;
  }

  /**
   * Release operation lock
   */
  private releaseOperationLock(): void {
    this.operationLock = null;
    this.processNextOperation();
  }

  /**
   * Process next pending operation if any
   */
  private processNextOperation(): void {
    if (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations.shift()!;

      if (operation.type === 'start') {
        // Don't auto-start pending downloads - just resolve the promise
        // This prevents unwanted automatic restarts
        operation.resolve();
      } else if (operation.type === 'cancel') {
        this.executeCancelOperation()
          .then(operation.resolve)
          .catch(operation.reject);
      }
    }
  }

  /**
   * Start downloads with given configuration (with atomic operation protection)
   */
  async startDownloads(config: DownloadConfig, data: any[]): Promise<void> {
    // Atomic check and lock acquisition
    const unlock = await this.acquireOperationLock();

    try {
      if (this.isDownloading) {
        throw new Error('Downloads already in progress');
      }

      this.isDownloading = true;
      this.cancelled = false;
      this.currentAbortController = new AbortController();
      this.startTime = Date.now();

      // Reset progress
      this.progress = {
        currentFile: '',
        successful: 0,
        failed: 0,
        total: 0,
        percentage: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        backgroundProcessed: 0,
      };

      try {
        const downloadItems = await this.prepareDownloadItems(config, data);
        this.progress.total = downloadItems.reduce(
          (sum, item) =>
            sum + item.imageFilePaths.length + (item.pdfFilePath ? 1 : 0),
          0
        );

        console.log(
          `Prepared ${downloadItems.length} download items with ${this.progress.total} total files`
        ); // Debug log
        this.updateProgress({ total: this.progress.total });

        // Create CSV log file
        const logFolder = config.imageFolder || config.pdfFolder;
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const logFile = safeJoin(logFolder, `DownloadLog_${timestamp}.csv`);

        await this.initializeLogFile(logFile);

        // Process downloads in batches
        const batchSize = Math.min(10, config.maxWorkers * 2);
        for (
          let i = 0;
          i < downloadItems.length && !this.cancelled;
          i += batchSize
        ) {
          const batch = downloadItems.slice(i, i + batchSize);

          await this.processBatch(batch, config, logFile);
          this.updateProgress({
            percentage:
              ((this.progress.successful + this.progress.failed) /
                this.progress.total) *
              100,
          });
        }

        this.emit('complete', {
          successful: this.progress.successful,
          failed: this.progress.failed,
          total: this.progress.total,
          backgroundProcessed: this.progress.backgroundProcessed,
          logFile,
          cancelled: this.cancelled,
        });
      } catch (error) {
        this.emit('error', error);
        throw error;
      } finally {
        this.isDownloading = false;
        this.releaseOperationLock();
      }
    } catch (error) {
      unlock();
      throw error;
    }
  }

  /**
   * Process a batch of download items
   */
  private async processBatch(
    batch: DownloadJobItem[],
    config: DownloadConfig,
    logFile: string
  ): Promise<void> {
    for (const item of batch) {
      if (this.cancelled || this.currentAbortController?.signal.aborted) break;

      // Download images sequentially with cancellation checks
      for (let i = 0; i < item.imageFilePaths.length; i++) {
        if (this.cancelled || this.currentAbortController?.signal.aborted)
          break;

        const url = item.urls[i];
        const filePath = item.imageFilePaths[i];
        const networkPath = item.networkImagePaths[i];

        await this.downloadSingleFile(
          item,
          url,
          filePath,
          networkPath,
          'image',
          config,
          logFile
        );
      }

      // Download PDF if not cancelled
      if (
        !this.cancelled &&
        !this.currentAbortController?.signal.aborted &&
        item.pdfFilePath &&
        item.pdfUrl
      ) {
        await this.downloadSingleFile(
          item,
          item.pdfUrl,
          item.pdfFilePath,
          item.networkPdfPath!,
          'pdf',
          config,
          logFile
        );
      }
    }
  }

  /**
   * Download a single file and log the result
   */
  private async downloadSingleFile(
    item: DownloadJobItem,
    url: string,
    filePath: string,
    networkPath: string,
    type: 'image' | 'pdf',
    config: DownloadConfig,
    logFile: string
  ): Promise<void> {
    if (this.cancelled) return;

    const filename = path.basename(filePath);
    this.updateProgress({ currentFile: filename });

    try {
      const result = await this.downloadFile(
        url,
        filePath,
        3, // retry count
        item.partNumber,
        config.sourceImageFolder,
        item.customFilename,
        config,
        this.currentAbortController?.signal
      );

      // Update network path in result
      result.networkPath = networkPath;

      // Update counters
      if (result.success) {
        this.progress.successful++;
        if (result.backgroundProcessed) {
          this.progress.backgroundProcessed++;
        }
      } else {
        this.progress.failed++;
      }

      // Log to CSV
      await this.writeToLog(logFile, item, result);

      this.updateProgress({
        successful: this.progress.successful,
        failed: this.progress.failed,
        backgroundProcessed: this.progress.backgroundProcessed,
      });
    } catch (error) {
      this.progress.failed++;

      const failedResult: DownloadResult = {
        success: false,
        url,
        filePath,
        networkPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        backgroundProcessed: false,
      };

      await this.writeToLog(logFile, item, failedResult);

      this.updateProgress({
        failed: this.progress.failed,
      });
    }
  }

  /**
   * Initialize CSV log file with headers
   * Matches Python implementation (Lines 1990-1995)
   */
  private async initializeLogFile(logFile: string): Promise<void> {
    const headers = [
      'Row',
      'Product Code',
      'URL',
      'Status',
      'HTTP Status',
      'Content-Type',
      'File Size (Bytes)',
      'Message',
      'Local File Path',
      'Photo File Path',
      'Background Processed',
    ];

    const csvContent = headers.join(',') + '\n';
    await fs.writeFile(logFile, csvContent, 'utf8');
  }

  /**
   * Write download result to CSV log
   * Matches Python implementation (Lines 2237-2280)
   */
  private async writeToLog(
    logFile: string,
    item: DownloadJobItem,
    result: DownloadResult
  ): Promise<void> {
    try {
      const status = result.success ? 'Success' : 'Failure';
      const backgroundProcessed = result.backgroundProcessed ? 'Yes' : 'No';
      const localPath = result.success ? result.filePath : '';
      const networkPath = result.success ? result.networkPath : '';

      const row = [
        item.rowNumber,
        `"${item.partNumber}"`, // Quote to handle commas in part numbers
        `"${result.url}"`,
        status,
        result.httpStatus || 0,
        `"${result.contentType || ''}"`,
        result.fileSize || 0,
        `"${result.error || result.success ? 'Success' : 'Unknown error'}"`,
        `"${localPath}"`,
        `"${networkPath}"`,
        backgroundProcessed,
      ];

      const csvLine = row.join(',') + '\n';
      await fs.appendFile(logFile, csvLine, 'utf8');
    } catch (error) {
      logger.error(
        'Error writing to log file',
        error instanceof Error ? error : new Error(String(error)),
        'DownloadService'
      );
    }
  }

  /**
   * Execute cancel operation (internal method)
   */
  private async executeCancelOperation(): Promise<void> {
    this.cancelled = true;
    this.isDownloading = false;
    this.emit('cancelled');
  }

  /**
   * Cancel ongoing downloads immediately
   */
  async cancelDownloads(): Promise<void> {
    // Immediate cancellation - no waiting for locks
    this.cancelled = true;
    this.isDownloading = false;

    // Abort all HTTP requests immediately
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }

    // Emit cancelled event for UI update
    this.emit('cancelled');
  }

  /**
   * Check if downloads are currently running
   */
  isRunning(): boolean {
    return this.isDownloading;
  }

  /**
   * Get current progress
   */
  getProgress(): DownloadProgress {
    return { ...this.progress };
  }
}
