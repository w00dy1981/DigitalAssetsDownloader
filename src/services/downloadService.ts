import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import axios, { AxiosResponse } from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { DownloadConfig, DownloadItem, DownloadResult, DownloadProgress } from '@/shared/types';
import { EventEmitter } from 'events';
// Import Sharp with error handling
let sharp: any = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('Sharp not available:', error);
}

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
  private progress: DownloadProgress = {
    currentFile: '',
    successful: 0,
    failed: 0,
    total: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    backgroundProcessed: 0
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
   * Smart detection for images that need background processing
   */
  private async needsBackgroundProcessing(imageBuffer: Buffer): Promise<boolean> {
    if (!sharp) {
      return false; // Skip processing if Sharp not available
    }
    
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      // Only process PNG files with actual transparency
      if (metadata.format === 'png' && metadata.hasAlpha) {
        // Sample a small region to check for transparency (much faster)
        const sampleSize = 100; // Sample 100x100 pixels max
        const { data } = await sharp(imageBuffer)
          .resize(Math.min(metadata.width || sampleSize, sampleSize), 
                  Math.min(metadata.height || sampleSize, sampleSize))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        // Check every 10th alpha pixel for efficiency
        for (let i = 3; i < data.length; i += 40) { // Sample every 10th pixel's alpha
          if (data[i] < 255) {
            console.log('Found transparency in PNG - needs background processing');
            return true;
          }
        }
        
        console.log('PNG has alpha channel but no actual transparency - skipping processing');
        return false;
      }
      
      // Skip all other formats (JPEG, etc.) - they don't have transparency
      return false;
    } catch (error) {
      console.warn('Error checking image for background processing needs:', error);
      return false;
    }
  }

  /**
   * Convert image to JPEG format with smart background processing
   */
  private async convertToJpg(imageBuffer: Buffer, quality = 95, config?: DownloadConfig): Promise<{buffer: Buffer, backgroundProcessed: boolean}> {
    if (!sharp) {
      console.warn('Sharp not available - returning original image buffer');
      return { buffer: imageBuffer, backgroundProcessed: false };
    }
    
    // Check if background processing is enabled
    const backgroundProcessingEnabled = config?.backgroundProcessing?.enabled ?? false;
    
    try {
      const needsProcessing = backgroundProcessingEnabled && await this.needsBackgroundProcessing(imageBuffer);
      
      if (needsProcessing) {
        // Apply white background to handle transparency
        const processedBuffer = await sharp(imageBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background
          .jpeg({ quality })
          .toBuffer();
        
        console.log('Image processed: transparency replaced with white background');
        return { buffer: processedBuffer, backgroundProcessed: true };
      } else {
        // Just convert to JPEG without background processing
        const processedBuffer = await sharp(imageBuffer)
          .jpeg({ quality })
          .toBuffer();
        
        return { buffer: processedBuffer, backgroundProcessed: false };
      }
    } catch (error) {
      console.error('Sharp image processing failed:', error);
      // Return original buffer if processing fails
      return { buffer: imageBuffer, backgroundProcessed: false };
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
      const stats = await fs.stat(sourceFolder);
      if (!stats.isDirectory()) {
        return null;
      }

      const files = await fs.readdir(sourceFolder);
      const matchingFiles: string[] = [];

      // First try to match specific filename if provided
      if (specificFilename) {
        const cleanFilename = specificFilename.toLowerCase();
        for (const file of files) {
          if (file.toLowerCase().includes(cleanFilename)) {
            const fullPath = path.join(sourceFolder, file);
            const fileStat = await fs.stat(fullPath);
            if (fileStat.isFile()) {
              matchingFiles.push(fullPath);
            }
          }
        }
      }

      // If no matches with specific filename, try part number
      if (matchingFiles.length === 0 && partNo) {
        const cleanPartNo = String(partNo).trim().toLowerCase();
        for (const file of files) {
          if (file.toLowerCase().includes(cleanPartNo)) {
            const fullPath = path.join(sourceFolder, file);
            const fileStat = await fs.stat(fullPath);
            if (fileStat.isFile()) {
              matchingFiles.push(fullPath);
            }
          }
        }
      }

      return matchingFiles.length > 0 ? matchingFiles[0] : null;
    } catch (error) {
      console.error('Error searching source folder:', error);
      return null;
    }
  }

  /**
   * Download file with comprehensive error handling and retry logic
   * Matches Python implementation (Lines 380-580)
   */
  private async downloadFile(
    url: string,
    filepath: string,
    retryCount = 3,
    partNo?: string,
    sourceFolder?: string,
    specificFilename?: string,
    config?: DownloadConfig
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
      backgroundProcessed
    });

    // Check source folder first (Lines 340-362)
    if (sourceFolder) {
      try {
        const sourceFile = await this.searchSourceFolder(sourceFolder, partNo || '', specificFilename);
        if (sourceFile) {
          // Create directory if it doesn't exist
          await fs.mkdir(path.dirname(filepath), { recursive: true });
          
          // Read source file
          const content = await fs.readFile(sourceFile);
          
          // Process image if it's an image file
          let processedContent = content;
          let backgroundProcessed = false;
          
          const isImageFile = /\.(jpg|jpeg|png|gif|bmp)$/i.test(sourceFile);
          if (isImageFile) {
            try {
              const result = await this.convertToJpg(content, 95, config);
              processedContent = result.buffer;
              backgroundProcessed = result.backgroundProcessed;
            } catch (error) {
              console.warn(`Image processing failed for ${sourceFile}:`, error);
              // Continue with original content if processing fails
            }
          }
          
          // Write processed content
          await fs.writeFile(filepath, processedContent);
          
          return createResult(
            true,
            200,
            'local_file_processed',
            processedContent.length,
            'File copied and processed from source folder',
            backgroundProcessed
          );
        }
      } catch (error) {
        return createResult(
          false,
          0,
          '',
          0,
          `Error accessing source folder: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Check if URL is a local file path
    try {
      const urlStat = await fs.stat(url);
      if (urlStat.isFile()) {
        // Handle local file
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        const content = await fs.readFile(url);
        
        // Process image if it's an image file
        let processedContent = content;
        let backgroundProcessed = false;
        
        const isImageFile = /\.(jpg|jpeg|png|gif|bmp)$/i.test(url);
        if (isImageFile) {
          try {
            const result = await this.convertToJpg(content, 95, config);
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            console.warn('Image processing failed:', error);
          }
        }
        
        await fs.writeFile(filepath, processedContent);
        
        return createResult(
          true,
          200,
          'local_file_processed',
          processedContent.length,
          'File copied and processed successfully',
          backgroundProcessed
        );
      } else if (urlStat.isDirectory()) {
        // Handle local directory - look for image files
        const files = await fs.readdir(url);
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
        
        const imageFiles = files.filter(file => 
          imageExtensions.some(ext => file.toLowerCase().endsWith(ext))
        );
        
        if (imageFiles.length > 0) {
          const sourceFile = path.join(url, imageFiles[0]);
          await fs.mkdir(path.dirname(filepath), { recursive: true });
          
          const content = await fs.readFile(sourceFile);
          let processedContent = content;
          let backgroundProcessed = false;
          
          try {
            const result = await this.convertToJpg(content, 95, config);
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            console.warn('Image processing failed:', error);
          }
          
          await fs.writeFile(filepath, processedContent);
          
          return createResult(
            true,
            200,
            'local_file_processed',
            processedContent.length,
            `File copied and processed from directory (${imageFiles.length} images found)`,
            backgroundProcessed
          );
        } else {
          return createResult(false, 0, '', 0, 'No image files found in directory');
        }
      }
    } catch {
      // Not a local file/directory, continue with HTTP download
    }

    // HTTP download with retry logic (Lines 520-580)
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    for (let attempt = 0; attempt < retryCount; attempt++) {
      if (this.cancelled) {
        return createResult(false, 0, '', 0, 'Download cancelled');
      }

      try {
        const response: AxiosResponse = await axios({
          method: 'GET',
          url,
          headers,
          timeout: 30000, // 30 second timeout
          responseType: 'arraybuffer'
        });

        const content = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || '';

        // Process images to JPG format
        let processedContent = content;
        let backgroundProcessed = false;
        
        if (contentType.startsWith('image/') && !filepath.toLowerCase().endsWith('.pdf')) {
          try {
            const result = await this.convertToJpg(content, 95, config);
            processedContent = result.buffer;
            backgroundProcessed = result.backgroundProcessed;
          } catch (error) {
            if (attempt === retryCount - 1) {
              return createResult(
                false,
                response.status,
                contentType,
                0,
                `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
            continue; // Retry if not last attempt
          }
        }

        // Create directory and write file
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        await fs.writeFile(filepath, processedContent);

        return createResult(
          true,
          response.status,
          contentType,
          processedContent.length,
          'Success',
          backgroundProcessed
        );

      } catch (error) {
        if (attempt === retryCount - 1) {
          // Last attempt failed
          if (axios.isAxiosError(error)) {
            return createResult(
              false,
              error.response?.status || 0,
              '',
              0,
              error.code === 'ECONNABORTED' ? 'Timeout error' : error.message
            );
          } else {
            return createResult(
              false,
              0,
              '',
              0,
              `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
        
        // Exponential backoff delay
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return createResult(false, 0, '', 0, 'Download failed after all retry attempts');
  }

  /**
   * Update progress and emit progress event
   */
  private updateProgress(update: Partial<DownloadProgress>): void {
    this.progress = { ...this.progress, ...update };
    
    // Calculate elapsed time
    if (this.startTime > 0) {
      this.progress.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
    }
    
    // Calculate percentage
    if (this.progress.total > 0) {
      this.progress.percentage = ((this.progress.successful + this.progress.failed) / this.progress.total) * 100;
    }
    
    // Calculate estimated time remaining
    if (this.progress.percentage > 0 && this.progress.percentage < 100) {
      const totalEstimatedTime = (this.progress.elapsedTime * 100) / this.progress.percentage;
      this.progress.estimatedTimeRemaining = Math.max(0, Math.floor(totalEstimatedTime - this.progress.elapsedTime));
    } else {
      this.progress.estimatedTimeRemaining = 0;
    }
    
    console.log('Emitting progress:', this.progress); // Debug log
    this.emit('progress', this.progress);
  }

  /**
   * Prepare download items from configuration and spreadsheet data
   */
  private async prepareDownloadItems(config: DownloadConfig, data: any[]): Promise<DownloadJobItem[]> {
    const items: DownloadJobItem[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1;
      const partNumber = row[config.partNoColumn];
      
      if (!partNumber) continue; // Skip rows without part numbers

      const sanitizedPartNo = this.sanitizeFilename(String(partNumber));
      const customFilename = config.filenameColumn ? row[config.filenameColumn] : undefined;

      // Prepare image downloads
      const imageFilePaths: string[] = [];
      const networkImagePaths: string[] = [];
      const urls: string[] = [];

      for (const column of config.imageColumns) {
        const url = row[column];
        if (url) {
          urls.push(String(url));
          const filename = `${sanitizedPartNo}.jpg`;
          const localPath = path.join(config.imageFolder, filename);
          const imageNetworkPath = config.imageFilePath?.trim() || "U:\\old_g\\IMAGES\\ABM Product Images";
          const networkPath = path.join(imageNetworkPath, filename);
          
          imageFilePaths.push(localPath);
          networkImagePaths.push(networkPath);
        }
      }

      // Prepare PDF download
      let pdfFilePath: string | undefined;
      let networkPdfPath: string | undefined;
      
      if (config.pdfColumn && row[config.pdfColumn]) {
        const pdfFilename = `${sanitizedPartNo}.pdf`;
        pdfFilePath = path.join(config.pdfFolder, pdfFilename);
        const pdfNetworkPath = config.pdfFilePath?.trim() || "U:\\old_g\\IMAGES\\Product pdf\\'s";
        networkPdfPath = path.join(pdfNetworkPath, pdfFilename);
        
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
          networkPdfPath
        });
      }
    }

    return items;
  }

  /**
   * Start downloads with given configuration
   */
  async startDownloads(config: DownloadConfig, data: any[]): Promise<void> {
    if (this.isDownloading) {
      throw new Error('Downloads already in progress');
    }

    this.isDownloading = true;
    this.cancelled = false;
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
      backgroundProcessed: 0
    };

    try {
      const downloadItems = await this.prepareDownloadItems(config, data);
      this.progress.total = downloadItems.reduce((sum, item) => 
        sum + item.imageFilePaths.length + (item.pdfFilePath ? 1 : 0), 0
      );

      console.log(`Prepared ${downloadItems.length} download items with ${this.progress.total} total files`); // Debug log
      this.updateProgress({ total: this.progress.total });

      // Create CSV log file
      const logFolder = config.imageFolder || config.pdfFolder;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const logFile = path.join(logFolder, `DownloadLog_${timestamp}.csv`);
      
      await this.initializeLogFile(logFile);

      // Process downloads in batches
      const batchSize = Math.min(10, config.maxWorkers * 2);
      let processed = 0;

      for (let i = 0; i < downloadItems.length && !this.cancelled; i += batchSize) {
        const batch = downloadItems.slice(i, i + batchSize);
        
        await this.processBatch(batch, config, logFile);
        
        processed += batch.length;
        this.updateProgress({ 
          percentage: (this.progress.successful + this.progress.failed) / this.progress.total * 100 
        });
      }

      this.emit('complete', {
        successful: this.progress.successful,
        failed: this.progress.failed,
        total: this.progress.total,
        backgroundProcessed: this.progress.backgroundProcessed,
        logFile,
        cancelled: this.cancelled
      });

    } catch (error) {
      this.emit('error', error);
    } finally {
      this.isDownloading = false;
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
    const downloadPromises: Promise<void>[] = [];

    for (const item of batch) {
      if (this.cancelled) break;

      // Download images
      for (let i = 0; i < item.imageFilePaths.length; i++) {
        const url = item.urls[i];
        const filePath = item.imageFilePaths[i];
        const networkPath = item.networkImagePaths[i];

        downloadPromises.push(
          this.downloadSingleFile(item, url, filePath, networkPath, 'image', config, logFile)
        );
      }

      // Download PDF
      if (item.pdfFilePath && item.pdfUrl) {
        downloadPromises.push(
          this.downloadSingleFile(item, item.pdfUrl, item.pdfFilePath, item.networkPdfPath!, 'pdf', config, logFile)
        );
      }
    }

    // Wait for batch to complete
    await Promise.allSettled(downloadPromises);
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
        config
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
      await this.writeToLog(logFile, item, result, type);

      this.updateProgress({
        successful: this.progress.successful,
        failed: this.progress.failed,
        backgroundProcessed: this.progress.backgroundProcessed
      });

    } catch (error) {
      this.progress.failed++;
      
      const failedResult: DownloadResult = {
        success: false,
        url,
        filePath,
        networkPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        backgroundProcessed: false
      };

      await this.writeToLog(logFile, item, failedResult, type);
      
      this.updateProgress({
        failed: this.progress.failed
      });
    }
  }

  /**
   * Initialize CSV log file with headers
   * Matches Python implementation (Lines 1990-1995)
   */
  private async initializeLogFile(logFile: string): Promise<void> {
    const headers = [
      'Row', 'Product Code', 'URL', 'Status', 'HTTP Status',
      'Content-Type', 'File Size (Bytes)', 'Message',
      'Local File Path', 'Photo File Path', 'Background Processed'
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
    result: DownloadResult,
    type: 'image' | 'pdf'
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
        backgroundProcessed
      ];

      const csvLine = row.join(',') + '\n';
      await fs.appendFile(logFile, csvLine, 'utf8');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  /**
   * Cancel ongoing downloads
   */
  cancelDownloads(): void {
    this.cancelled = true;
    this.isDownloading = false;
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
