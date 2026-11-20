import { FormGroup } from '@/renderer/components/ui';

import type { MappingFields } from './useColumnSelectionState';
const ColumnMappingPanel = ({
  config,
  update,
  columns,
}: MappingFields & { columns: string[] }) => {
  return (
    <div className="config-section">
      <h3>Column Mapping</h3>

      <ColumnField
        id="part-column"
        label="Part Number Column *"
        helpText="Required: Column containing unique part numbers for each item"
        value={config.partNoColumn}
        onChange={value => update('partNoColumn', value)}
        columns={columns}
      />
      <ColumnField
        id="image-column"
        label="Image URL Column"
        helpText="Select the column containing image URLs for download"
        value={config.imageColumns[0] || ''}
        onChange={value => update('imageColumns', value ? [value] : [])}
        columns={columns}
      />
      <ColumnField
        id="pdf-column"
        label="PDF URL Column"
        helpText="Select the column containing PDF URLs for download"
        value={config.pdfColumn}
        onChange={value => update('pdfColumn', value)}
        columns={columns}
      />
      <ColumnField
        id="filename-column"
        label="Custom Filename Column (Optional)"
        helpText="Used for filename matching when searching source folders. If not specified, part numbers will be used."
        value={config.filenameColumn}
        onChange={value => update('filenameColumn', value)}
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
