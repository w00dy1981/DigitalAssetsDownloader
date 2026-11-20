import React from 'react';
import { FormGroup } from '@/renderer/components/ui';

interface ColumnMappingPanelProps {
  partNoColumn: string;
  onPartNoColumnChange: (value: string) => void;
  imageColumns: string[];
  onImageColumnsChange: (value: string[]) => void;
  pdfColumn: string;
  onPdfColumnChange: (value: string) => void;
  filenameColumn: string;
  onFilenameColumnChange: (value: string) => void;
  columns: string[];
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
  columns,
}) => {
  return (
    <div className="config-section">
      <h3>Column Mapping</h3>

      <ColumnField
        id="part-column"
        label="Part Number Column *"
        helpText="Required: Column containing unique part numbers for each item"
        value={partNoColumn}
        onChange={onPartNoColumnChange}
        columns={columns}
      />
      <ColumnField
        id="image-column"
        label="Image URL Column"
        helpText="Select the column containing image URLs for download"
        value={imageColumns[0] || ''}
        onChange={value => onImageColumnsChange(value ? [value] : [])}
        columns={columns}
      />
      <ColumnField
        id="pdf-column"
        label="PDF URL Column"
        helpText="Select the column containing PDF URLs for download"
        value={pdfColumn}
        onChange={onPdfColumnChange}
        columns={columns}
      />
      <ColumnField
        id="filename-column"
        label="Custom Filename Column (Optional)"
        helpText="Used for filename matching when searching source folders. If not specified, part numbers will be used."
        value={filenameColumn}
        onChange={onFilenameColumnChange}
        columns={columns}
      />
    </div>
  );
};

function ColumnField({
  id,
  label,
  helpText,
  value,
  onChange,
  columns,
}: {
  id: string;
  label: string;
  helpText: string;
  value: string;
  onChange: (value: string) => void;
  columns: string[];
}) {
  return (
    <FormGroup label={label} htmlFor={id} helpText={helpText}>
      <select
        id={id}
        className="form-control"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Choose a column...</option>
        {columns.map(column => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </select>
    </FormGroup>
  );
}

export default ColumnMappingPanel;
