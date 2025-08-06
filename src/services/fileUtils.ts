/**
 * File utility functions for cross-platform file operations
 * Provides case-insensitive file extension checking for Windows compatibility
 */
import path from 'path';

/**
 * Check if a file has a specific extension (case-insensitive)
 * @param fileName - The file name or path to check
 * @param extension - The extension to check for (with or without leading dot)
 * @returns true if the file has the specified extension
 */
export const hasExtension = (fileName: string, extension: string): boolean => {
  if (!fileName || !extension) return false;

  const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
  return fileName.toLowerCase().endsWith(normalizedExt.toLowerCase());
};

/**
 * Check if a file has any of the specified extensions (case-insensitive)
 * @param fileName - The file name or path to check
 * @param extensions - Array of extensions to check for (with or without leading dots)
 * @returns true if the file has any of the specified extensions
 */
export const hasAnyExtension = (
  fileName: string,
  extensions: string[]
): boolean => {
  if (!fileName || !extensions.length) return false;

  return extensions.some(ext => hasExtension(fileName, ext));
};

/**
 * Get the file extension in lowercase for consistent comparison
 * @param filePath - The file path
 * @returns The lowercase extension (including the dot)
 */
export const getExtension = (filePath: string): string => {
  return path.extname(filePath).toLowerCase();
};

/**
 * Check if a file is an image based on its extension
 * @param fileName - The file name or path to check
 * @returns true if the file is an image
 */
export const isImageFile = (fileName: string): boolean => {
  const imageExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.webp',
    '.tiff',
    '.tif',
  ];
  return hasAnyExtension(fileName, imageExtensions);
};

/**
 * Check if a file is a PDF based on its extension
 * @param fileName - The file name or path to check
 * @returns true if the file is a PDF
 */
export const isPdfFile = (fileName: string): boolean => {
  return hasExtension(fileName, '.pdf');
};

/**
 * Check if a file is a CSV based on its extension
 * @param fileName - The file name or path to check
 * @returns true if the file is a CSV
 */
export const isCsvFile = (fileName: string): boolean => {
  return hasExtension(fileName, '.csv');
};

/**
 * Check if a file is an Excel file based on its extension
 * @param fileName - The file name or path to check
 * @returns true if the file is an Excel file
 */
export const isExcelFile = (fileName: string): boolean => {
  const excelExtensions = ['.xlsx', '.xls', '.xlsm'];
  return hasAnyExtension(fileName, excelExtensions);
};
