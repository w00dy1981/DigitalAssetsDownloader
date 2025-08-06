import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as csv from 'fast-csv';
import {
  sanitizePath,
  PathSecurityError,
  validateFileAccess,
} from './pathSecurity';
import { isCsvFile, isExcelFile, getExtension } from './fileUtils';
import { logger } from './LoggingService';

export interface SheetData {
  columns: string[];
  rows: Record<string, any>[];
}

export class ExcelService {
  /**
   * Get sheet names from an Excel file
   * Supports .xlsx, .xls, .xlsm formats
   */
  async getSheetNames(filePath: string): Promise<string[]> {
    try {
      logger.info(`[ExcelService] Getting sheet names for: ${filePath}`);

      // Sanitize the file path to prevent path traversal
      const safeFilePath = sanitizePath(filePath);
      logger.info(`[ExcelService] Sanitized path: ${safeFilePath}`);

      // Validate file access with timeout
      const validateWithTimeout = async (timeout: number = 5000) => {
        return Promise.race([
          validateFileAccess(safeFilePath),
          new Promise<boolean>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Network or file system timeout - please check the file location and try again'
                  )
                ),
              timeout
            )
          ),
        ]);
      };

      const isAccessible = await validateWithTimeout();
      if (!isAccessible) {
        throw new Error('File does not exist or is not accessible');
      }

      // Handle different file formats
      if (isCsvFile(safeFilePath)) {
        return ['Sheet1']; // CSV files have only one "sheet"
      }

      const workbook = new ExcelJS.Workbook();

      // Add timeout wrapper for Excel file reading
      const readWithTimeout = (timeout: number = 30000) => {
        return Promise.race([
          workbook.xlsx.readFile(safeFilePath),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`File read timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);
      };

      await readWithTimeout();

      const sheetNames: string[] = [];
      workbook.eachSheet(worksheet => {
        if (worksheet.name) {
          sheetNames.push(worksheet.name);
        }
      });

      if (sheetNames.length === 0) {
        throw new Error('No worksheets found in the Excel file');
      }

      return sheetNames;
    } catch (error) {
      if (error instanceof PathSecurityError) {
        logger.error(
          'Security violation in getSheetNames',
          error,
          'ExcelService'
        );
        throw new Error(`Security error: ${error.message}`);
      }
      logger.error(
        'Error getting sheet names',
        error instanceof Error ? error : new Error(String(error)),
        'ExcelService'
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // More specific error messages
      if (errorMessage.includes('timeout')) {
        throw new Error(
          'File reading timed out - the Excel file may be too large or corrupted'
        );
      }
      if (errorMessage.includes('ETIMEDOUT')) {
        throw new Error(
          'Network or file system timeout - please check the file location and try again'
        );
      }

      throw new Error(`Failed to read Excel file: ${errorMessage}`);
    }
  }

  /**
   * Load data from a specific sheet in an Excel file
   * Reference: Original app Lines 800-850
   */
  async loadSheetData(filePath: string, sheetName: string): Promise<SheetData> {
    try {
      // Sanitize the file path to prevent path traversal
      const safeFilePath = sanitizePath(filePath);

      // Validate file access
      if (!(await validateFileAccess(safeFilePath))) {
        throw new Error('File does not exist or is not accessible');
      }

      if (isCsvFile(safeFilePath)) {
        return this.loadCSVData(safeFilePath);
      }

      const workbook = new ExcelJS.Workbook();

      // Add timeout wrapper for Excel file reading
      const readWithTimeout = (timeout: number = 30000) => {
        return Promise.race([
          workbook.xlsx.readFile(safeFilePath),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`File read timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);
      };

      await readWithTimeout();

      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in the workbook`);
      }

      // Check if worksheet has any data
      if (worksheet.rowCount === 0) {
        throw new Error('The selected sheet is empty');
      }

      return this.parseWorksheet(worksheet);
    } catch (error) {
      if (error instanceof PathSecurityError) {
        logger.error(
          'Security violation in loadSheetData',
          error,
          'ExcelService'
        );
        throw new Error(`Security error: ${error.message}`);
      }
      logger.error(
        'Error loading sheet data',
        error instanceof Error ? error : new Error(String(error)),
        'ExcelService'
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // More specific error messages
      if (errorMessage.includes('timeout')) {
        throw new Error(
          'File reading timed out - the Excel file may be too large or corrupted'
        );
      }
      if (errorMessage.includes('ETIMEDOUT')) {
        throw new Error(
          'Network or file system timeout - please check the file location and try again'
        );
      }
      if (errorMessage.includes('No valid column headers')) {
        throw new Error(
          'The first row of the sheet does not contain valid column headers. Please ensure the first row has column names.'
        );
      }

      throw new Error(`Failed to load sheet data: ${errorMessage}`);
    }
  }

  /**
   * Load CSV data
   * CSV files are treated as having one sheet called "Sheet1"
   */
  private async loadCSVData(filePath: string): Promise<SheetData> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      let columns: string[] = [];
      let isFirstRow = true;

      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true, ignoreEmpty: true }))
        .on('headers', (headers: string[]) => {
          columns = headers.map(header => header.trim()).filter(Boolean);
        })
        .on('data', (row: Record<string, any>) => {
          if (isFirstRow) {
            isFirstRow = false;
            // If headers weren't detected properly, use the first row as headers
            if (columns.length === 0) {
              columns = Object.keys(row);
            }
          }

          // Clean up the row data
          const cleanRow: Record<string, any> = {};
          columns.forEach(col => {
            const value = row[col];
            cleanRow[col] =
              value !== undefined && value !== null ? String(value).trim() : '';
          });

          rows.push(cleanRow);
        })
        .on('end', () => {
          resolve({ columns, rows });
        })
        .on('error', error => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          reject(new Error(`Failed to parse CSV file: ${errorMessage}`));
        });
    });
  }

  /**
   * Parse an ExcelJS worksheet into our data format
   * Reference: Original app data structure handling
   */
  private parseWorksheet(worksheet: ExcelJS.Worksheet): SheetData {
    const rows: Record<string, any>[] = [];
    const columns: string[] = [];

    // Check if worksheet has enough rows
    if (worksheet.rowCount < 1) {
      throw new Error('The worksheet is empty or has no data');
    }

    // Get column headers from the first row with improved parsing
    const headerRow = worksheet.getRow(1);
    const columnMap: Map<number, string> = new Map();

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = cell.value;
      let columnName = '';

      if (value !== null && value !== undefined) {
        // Handle different cell value types more robustly
        if (typeof value === 'string') {
          columnName = value;
        } else if (typeof value === 'number') {
          columnName = value.toString();
        } else if (value instanceof Date) {
          columnName = value.toISOString();
        } else if (value && typeof value === 'object') {
          // Handle rich text and formula results
          if ('text' in value) {
            columnName = (value as any).text;
          } else if ('result' in value) {
            columnName = String((value as any).result || '');
          } else if (
            'richText' in value &&
            Array.isArray((value as any).richText)
          ) {
            columnName = (value as any).richText
              .map((rt: any) => rt.text || '')
              .join('');
          } else {
            columnName = String(value);
          }
        } else {
          columnName = String(value);
        }
      }

      columnName = columnName.trim();
      if (columnName && columnName !== '') {
        columnMap.set(colNumber, columnName);
      }
    });

    // Convert map to array, maintaining column order
    const maxCol = Math.max(...columnMap.keys());
    for (let i = 1; i <= maxCol; i++) {
      if (columnMap.has(i)) {
        columns.push(columnMap.get(i)!);
      }
    }

    if (columns.length === 0) {
      throw new Error(
        'No valid column headers found in the first row. Please ensure the first row contains column names.'
      );
    }

    // Process data rows (starting from row 2)
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData: Record<string, any> = {};
      let hasData = false;

      columns.forEach((columnName, index) => {
        const cell = row.getCell(index + 1);
        let value = '';

        if (cell.value !== null && cell.value !== undefined) {
          // Handle different cell value types
          if (typeof cell.value === 'string') {
            value = cell.value;
          } else if (typeof cell.value === 'number') {
            value = cell.value.toString();
          } else if (cell.value instanceof Date) {
            value = cell.value.toISOString();
          } else if (cell.value && typeof cell.value === 'object') {
            // Handle formula results and rich text
            if ('result' in cell.value) {
              value = String((cell.value as any).result || '');
            } else if ('text' in cell.value) {
              value = String((cell.value as any).text || '');
            } else {
              value = String(cell.value);
            }
          } else {
            value = String(cell.value);
          }

          value = value.trim();
          if (value) {
            hasData = true;
          }
        }

        rowData[columnName] = value;
      });

      // Only add rows that have at least some data
      if (hasData) {
        rows.push(rowData);
      }
    }

    return { columns, rows };
  }

  /**
   * Validate if a file can be processed by this service
   */
  static isValidFile(filePath: string): boolean {
    return isExcelFile(filePath) || isCsvFile(filePath);
  }

  /**
   * Get file format information
   */
  static getFileInfo(filePath: string): {
    type: string;
    extension: string;
    isValid: boolean;
  } {
    const extension = getExtension(filePath);
    let type = 'Unknown';

    switch (extension) {
      case '.xlsx':
        type = 'Excel 2007+ (.xlsx)';
        break;
      case '.xls':
        type = 'Excel 97-2003 (.xls)';
        break;
      case '.xlsm':
        type = 'Excel Macro-Enabled (.xlsm)';
        break;
      case '.csv':
        type = 'Comma Separated Values (.csv)';
        break;
    }

    return {
      type,
      extension,
      isValid: this.isValidFile(filePath),
    };
  }
}
