import React from 'react';
import { Select } from '@/renderer/components/ui';

interface ColumnMappingPanelProps {
  partNoColumn: string;
  onPartNoColumnChange: (value: string) => void;
  imageColumns: string[];
  onImageColumnsChange: (value: string[]) => void;
  pdfColumn: string;
  onPdfColumnChange: (value: string) => void;
  filenameColumn: string;
  onFilenameColumnChange: (value: string) => void;
  columnOptions: Array<{ value: string; label: string }>;
}

const ColumnMappingPanel: React.FC<ColumnMappingPanelProps> = ({
  partNoColumn,
  onPartNoColumnChange,
  imageColumns,
  onImageColumnsChange,
  pdfColumn,
  onPdfColumnChange,
  filenameColumn,
  onFilenameColumnChange,
  columnOptions,
}) => {
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
          onChange={value => onImageColumnsChange(value ? [value] : [])}
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
          onChange={onPdfColumnChange}
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
