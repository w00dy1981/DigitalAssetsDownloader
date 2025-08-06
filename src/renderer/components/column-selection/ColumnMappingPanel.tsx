import React, { useCallback } from 'react';
import { SpreadsheetData } from '@/shared/types';
import { Select } from '@/renderer/components/ui';

interface ColumnMappingPanelProps {
  data: SpreadsheetData;
  partNoColumn: string;
  onPartNoColumnChange: (value: string) => void;
  imageColumns: string[];
  onImageColumnsChange: (value: string[]) => void;
  pdfColumn: string;
  onPdfColumnChange: (value: string) => void;
  filenameColumn: string;
  onFilenameColumnChange: (value: string) => void;
  columnOptions: Array<{ value: string; label: string }>;
  onValidationError?: (error: string) => void;
}

const ColumnMappingPanel: React.FC<ColumnMappingPanelProps> = ({
  data,
  partNoColumn,
  onPartNoColumnChange,
  imageColumns,
  onImageColumnsChange,
  pdfColumn,
  onPdfColumnChange,
  filenameColumn,
  onFilenameColumnChange,
  columnOptions,
  onValidationError,
}) => {
  // Simple browser-safe URL validation
  const validateColumnUrls = useCallback(
    (columnName: string): boolean => {
      if (!columnName || !data.rows.length) return true;

      const columnIndex = data.columns.indexOf(columnName);
      if (columnIndex === -1) return true;

      // Check a sample of URLs from the column (first 5 non-empty values)
      const sampleUrls = data.rows
        .slice(0, 20) // Check first 20 rows
        .map(row => row[columnIndex])
        .filter(url => url && typeof url === 'string' && url.trim())
        .slice(0, 5); // Only validate first 5 URLs for performance

      for (const url of sampleUrls) {
        // Simple browser-safe URL validation using native URL constructor
        try {
          const urlObj = new URL(url as string);
          // Check for valid protocols
          if (!['http:', 'https:', 'ftp:', 'ftps:'].includes(urlObj.protocol)) {
            onValidationError?.(
              `Selected column contains invalid URLs. Example: "${url}" - Invalid protocol`
            );
            return false;
          }
        } catch {
          onValidationError?.(
            `Selected column contains invalid URLs. Example: "${url}" - Invalid URL format`
          );
          return false;
        }
      }

      return true;
    },
    [data, onValidationError]
  );

  const handleImageColumnChange = (value: string) => {
    if (value && !validateColumnUrls(value)) {
      return; // Validation failed, don't update
    }
    onImageColumnsChange(value ? [value] : []);
  };

  const handlePdfColumnChange = (value: string) => {
    if (value && !validateColumnUrls(value)) {
      return; // Validation failed, don't update
    }
    onPdfColumnChange(value);
  };

  return (
    <div className="config-section">
      <h3>Column Mapping</h3>

      {/* Part Number Column (Required) */}
      <div className="form-group">
        <label htmlFor="part-column">Part Number Column *</label>
        <Select
          value={partNoColumn}
          onChange={onPartNoColumnChange}
          options={columnOptions}
          placeholder="Choose a column..."
        />
        <small className="text-muted">
          Required: Column containing unique part numbers for each item
        </small>
      </div>

      {/* Image URL Columns */}
      <div className="form-group">
        <label htmlFor="image-column">Image URL Column</label>
        <Select
          value={imageColumns[0] || ''}
          onChange={handleImageColumnChange}
          options={columnOptions}
          placeholder="Choose a column..."
        />
        <small className="text-muted">
          Select the column containing image URLs for download
        </small>
      </div>

      {/* PDF Column */}
      <div className="form-group">
        <label htmlFor="pdf-column">PDF URL Column</label>
        <Select
          value={pdfColumn}
          onChange={handlePdfColumnChange}
          options={columnOptions}
          placeholder="Choose a column..."
        />
        <small className="text-muted">
          Select the column containing PDF URLs for download
        </small>
      </div>

      {/* Filename Column */}
      <div className="form-group">
        <label htmlFor="filename-column">
          Custom Filename Column (Optional)
        </label>
        <Select
          value={filenameColumn}
          onChange={onFilenameColumnChange}
          options={columnOptions}
          placeholder="Choose a column..."
        />
        <small className="text-muted">
          Used for filename matching when searching source folders. If not
          specified, part numbers will be used.
        </small>
      </div>
    </div>
  );
};

export default ColumnMappingPanel;
