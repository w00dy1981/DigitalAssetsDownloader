import type { DownloadOptions } from '@/download/downloadRun';
import type { UserSettings } from '@/shared/userSettings';

export const limits = {
  workers: { min: 1, max: 20 },
  connectionTimeout: { min: 1, max: 60 },
  readTimeout: { min: 10, max: 300 },
  retryAttempts: { min: 1, max: 10 },
  quality: { min: 60, max: 100 },
};

export function initialDownloadOptions({
  defaultPaths,
  downloadBehavior,
  imageProcessing,
}: UserSettings): DownloadOptions {
  return {
    partNoColumn: '',
    imageColumns: [],
    pdfColumn: '',
    filenameColumn: '',
    imageFolder: defaultPaths.imageDownloadFolder,
    pdfFolder: defaultPaths.pdfDownloadFolder,
    sourceImageFolder: defaultPaths.sourceImageFolder,
    imageFilePath: defaultPaths.imageNetworkPath,
    maxWorkers: downloadBehavior.defaultConcurrentDownloads,
    backgroundProcessing: {
      enabled: imageProcessing.enabledByDefault,
      quality: imageProcessing.defaultQuality,
    },
  };
}

function checkRange(
  errors: string[],
  name: string,
  value: number,
  { min, max }: { min: number; max: number }
) {
  if (!Number.isFinite(value)) errors.push(`${name} must be a valid number`);
  else if (value < min) errors.push(`${name} must be at least ${min}`);
  else if (value > max) errors.push(`${name} must be no more than ${max}`);
}

function checkFolder(errors: string[], name: string, folder: string) {
  if (typeof folder !== 'string' || !folder.trim())
    errors.push(`${name} is required`);
  else if (folder.includes('..') || folder.includes('\0'))
    errors.push(`${name} contains invalid or unsafe path characters`);
}

export function downloadConfigErrors(config: DownloadOptions): string[] {
  const errors: string[] = [];
  if (!config.partNoColumn?.trim())
    errors.push('Part Number Column is required');
  if (!config.imageColumns.length && !config.pdfColumn)
    errors.push('At least one Image URL column or PDF column is required');
  if (config.imageColumns.length)
    checkFolder(errors, 'Image Download Folder', config.imageFolder);
  if (config.pdfColumn)
    checkFolder(errors, 'PDF Download Folder', config.pdfFolder);
  checkRange(errors, 'Max Workers', config.maxWorkers, limits.workers);
  if (config.imageColumns.length) {
    checkRange(
      errors,
      'JPEG Quality',
      config.backgroundProcessing.quality,
      limits.quality
    );
  }
  return errors;
}

export function userSettingsErrors({
  downloadBehavior,
  imageProcessing,
}: UserSettings): string[] {
  const errors: string[] = [];
  checkRange(
    errors,
    'Concurrent Downloads',
    downloadBehavior.defaultConcurrentDownloads,
    limits.workers
  );
  checkRange(
    errors,
    'Connection Timeout',
    downloadBehavior.connectionTimeout,
    limits.connectionTimeout
  );
  checkRange(
    errors,
    'Read Timeout',
    downloadBehavior.readTimeout,
    limits.readTimeout
  );
  checkRange(
    errors,
    'Retry Attempts',
    downloadBehavior.retryAttempts,
    limits.retryAttempts
  );
  checkRange(
    errors,
    'Default JPEG Quality',
    imageProcessing.defaultQuality,
    limits.quality
  );
  return errors;
}
