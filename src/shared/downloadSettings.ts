import type { DownloadPlanConfig } from '@/download/downloadPlan';
import type { HttpSettings } from '@/download/assetSource';
import type { DownloadOptions } from '@/download/downloadRun';
import type { UserSettings } from '@/shared/userSettings';

export const limits = {
  previewRows: { min: 0, step: 1 },
  count: { min: 1, step: 1 },
  // Node timers above 2^31 - 1 milliseconds expire after just one millisecond.
  httpTimeout: { min: 0, max: 0x7fffffff / 1000, step: 0.001 },
  quality: { min: 1, max: 100, step: 'any' },
} as const;

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
  { min, max, step }: { min: number; max?: number; step: number | string }
) {
  if (!Number.isFinite(value)) errors.push(`${name} must be a valid number`);
  else if (step === 1 && !Number.isSafeInteger(value))
    errors.push(`${name} must be a whole number`);
  else if (value < min) errors.push(`${name} must be at least ${min}`);
  else if (max !== undefined && value > max)
    errors.push(`${name} must be no more than ${max}`);
}

function checkFolder(errors: string[], name: string, folder: string) {
  if (typeof folder !== 'string' || !folder) errors.push(`${name} is required`);
}

export function usesSourceImageFolder(config: DownloadPlanConfig): boolean {
  return Boolean(
    config.sourceImageFolder &&
      (config.imageColumns.length ||
        !config.pdfColumn ||
        config.includeFolderImagesWithPdfs)
  );
}

export function downloadConfigErrors(config: DownloadOptions): string[] {
  const errors: string[] = [];
  if (!config.partNoColumn?.trim())
    errors.push('Part Number Column is required');
  const hasImages =
    config.imageColumns.length > 0 || usesSourceImageFolder(config);
  if (!hasImages && !config.pdfColumn)
    errors.push(
      'Choose an image column, a source image folder or a PDF column'
    );
  if (hasImages)
    checkFolder(errors, 'Image Download Folder', config.imageFolder);
  if (config.pdfColumn)
    checkFolder(errors, 'PDF Download Folder', config.pdfFolder);
  checkRange(errors, 'Max Workers', config.maxWorkers, limits.count);
  if (hasImages) {
    checkRange(
      errors,
      'JPEG Quality',
      config.backgroundProcessing.quality,
      limits.quality
    );
  }
  return errors;
}

export function httpSettingsErrors(settings: HttpSettings): string[] {
  const errors: string[] = [];
  checkRange(
    errors,
    'Connection Timeout',
    settings.connectionTimeout,
    limits.httpTimeout
  );
  checkRange(errors, 'Read Timeout', settings.readTimeout, limits.httpTimeout);
  checkRange(errors, 'Download Attempts', settings.retryAttempts, limits.count);
  return errors;
}

export function userSettingsErrors({
  downloadBehavior,
  imageProcessing,
  sqlSettings,
}: UserSettings): string[] {
  const errors: string[] = [];
  checkRange(
    errors,
    'SQL preview rows',
    sqlSettings.previewRows,
    limits.previewRows
  );
  if (!Number.isFinite(sqlSettings.queryTimeoutMs))
    errors.push('SQL request timeout must be a valid number');
  checkRange(
    errors,
    'Concurrent Downloads',
    downloadBehavior.defaultConcurrentDownloads,
    limits.count
  );
  errors.push(...httpSettingsErrors(downloadBehavior));
  checkRange(
    errors,
    'Default JPEG Quality',
    imageProcessing.defaultQuality,
    limits.quality
  );
  return errors;
}
