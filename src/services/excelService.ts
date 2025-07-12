import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';
import { sanitizePath, PathSecurityError, validateFileAccess } from './pathSecurity';

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
      // Sanitize the file path to prevent path traversal
      const safeFilePath = sanitizePath(filePath);
      
      // Validate file access
      if (!(await validateFileAccess(safeFilePath))) {
        throw new Error('File does not exist or is not accessible');
      }

      const workbook = new ExcelJS.Workbook();
      
      // Handle different file formats
      if (safeFilePath.toLowerCase().endsWith('.csv')) {
        return ['Sheet1']; // CSV files have only one "sheet"
      }
      
      await workbook.xlsx.readFile(safeFilePath);
      
      const sheetNames: string[] = [];
      workbook.eachSheet((worksheet) => {
        sheetNames.push(worksheet.name);
      });
      
      return sheetNames;
    } catch (error) {
      if (error instanceof PathSecurityError) {
        console.error('Security violation in getSheetNames:', error.message);
        throw new Error(`Security error: ${error.message}`);
      }
      console.error('Error getting sheet names:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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

      if (safeFilePath.toLowerCase().endsWith('.csv')) {
        return this.loadCSVData(safeFilePath);
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(safeFilePath);
      
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in the workbook`);
      }

      return this.parseWorksheet(worksheet);
    } catch (error) {
      if (error instanceof PathSecurityError) {
        console.error('Security violation in loadSheetData:', error.message);
        throw new Error(`Security error: ${error.message}`);
      }
      console.error('Error loading sheet data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
            cleanRow[col] = value !== undefined && value !== null ? String(value).trim() : '';
          });
          
          rows.push(cleanRow);
        })
        .on('end', () => {
          resolve({ columns, rows });
        })
        .on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    let columns: string[] = [];
    
    // Get column headers from the first row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value;
      let columnName = '';
      
      if (value !== null && value !== undefined) {
        // Handle different cell value types
        if (typeof value === 'string') {
          columnName = value;
        } else if (typeof value === 'number') {
          columnName = value.toString();
        } else if (value && typeof value === 'object' && 'text' in value) {
          columnName = (value as any).text;
        } else {
          columnName = String(value);
        }
      }
      
      columnName = columnName.trim();
      if (columnName) {
        columns[colNumber - 1] = columnName;
      }
    });

    // Filter out empty columns
    columns = columns.filter(Boolean);
    
    if (columns.length === 0) {
      throw new Error('No valid column headers found in the first row');
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
    const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
    const ext = path.extname(filePath).toLowerCase();
    return validExtensions.includes(ext);
  }

  /**
   * Get file format information
   */
  static getFileInfo(filePath: string): { type: string; extension: string; isValid: boolean } {
    const extension = path.extname(filePath).toLowerCase();
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
      isValid: this.isValidFile(filePath)
    };
  }
}
