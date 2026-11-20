import { useState } from 'react';
import { downloadConfigErrors } from '@/shared/downloadSettings';
import type { WorkflowScreenProps } from '../App';
import { FolderSelector, FormGroup } from './ui';

const folders = [
  {
    key: 'imageFolder',
    label: 'Image Download Folder *',
    id: 'image-folder',
    placeholder: 'Select folder for downloaded images',
    helpText: 'Local folder where downloaded images will be saved',
  },
  {
    key: 'pdfFolder',
    label: 'PDF Download Folder *',
    id: 'pdf-folder',
    placeholder: 'Select folder for downloaded PDFs',
    helpText: 'Local folder where downloaded PDFs will be saved',
  },
  {
    key: 'sourceImageFolder',
    label: 'Source Image Folder (Optional)',
    id: 'source-folder',
    placeholder: 'Folder to search for existing images',
    helpText:
      'If specified, the system will search this folder for images matching part numbers before downloading',
  },
] as const;

export default function ColumnSelectionTab({
  data,
  onChange,
  onNext,
}: WorkflowScreenProps & { onNext: () => void }) {
  const { options } = data;
  const [error, setError] = useState('');

  function confirmMapping() {
    const errors = downloadConfigErrors(options);
    if (errors.length) setError(errors.join(' '));
    else onNext();
  }

  return (
    <div className="column-selection-tab">
      <h2 className="screen-title">Column Selection & Configuration</h2>
      <p className="mapping-intro">
        Map your input columns to the appropriate data types and configure
        download settings.
      </p>
      <p className="data-info">
        <strong>Loaded Data:</strong> {data.sheetName} ({data.rowCount} rows,{' '}
        {data.columns.length} columns)
      </p>

      {error && (
        <div role="alert" className="alert alert-danger mb-3">
          {error}
        </div>
      )}

      <div className="configuration-sections">
        <div className="config-section">
          <h3>Column Mapping</h3>

          <ColumnField
            id="part-column"
            label="Part Number Column *"
            helpText="Required: Column containing unique part numbers for each item"
            value={options.partNoColumn}
            onChange={value => onChange({ partNoColumn: value })}
            columns={data.columns}
          />
          <ColumnField
            id="image-column"
            label="Image URL Column"
            helpText="Select the column containing image URLs for download"
            value={options.imageColumns[0] || ''}
            onChange={value => onChange({ imageColumns: value ? [value] : [] })}
            columns={data.columns}
          />
          <ColumnField
            id="pdf-column"
            label="PDF URL Column"
            helpText="Select the column containing PDF URLs for download"
            value={options.pdfColumn}
            onChange={value => onChange({ pdfColumn: value })}
            columns={data.columns}
          />
          {options.sourceImageFolder &&
            options.pdfColumn &&
            !options.imageColumns.length && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(options.includeFolderImagesWithPdfs)}
                  onChange={e =>
                    onChange({ includeFolderImagesWithPdfs: e.target.checked })
                  }
                />
                Include images from Source Image Folder with these PDFs
              </label>
            )}
          <ColumnField
            id="filename-column"
            label="Custom Filename Column (Optional)"
            helpText="Used for filename matching when searching source folders. If not specified, part numbers will be used."
            value={options.filenameColumn}
            onChange={value => onChange({ filenameColumn: value })}
            columns={data.columns}
          />
        </div>
        <div className="config-section">
          <h3>Download Folders</h3>
          {folders.map(({ key, label, id, placeholder, helpText }) => (
            <FormGroup key={key} label={label} htmlFor={id} helpText={helpText}>
              <FolderSelector
                id={id}
                value={options[key]}
                placeholder={placeholder}
                onChange={value => onChange({ [key]: value })}
                onError={setError}
              />
            </FormGroup>
          ))}
          <FormGroup
            label="Image Network Path"
            htmlFor="mapping-image-network-path"
          >
            <FolderSelector
              id="mapping-image-network-path"
              value={options.imageFilePath}
              onChange={value => {
                onChange({ imageFilePath: value });
                void window.electronAPI
                  .saveImageNetworkPath(value)
                  .catch(error => setError(String(error)));
              }}
              placeholder="Shared folder for workbook photo references"
              onError={setError}
            />
          </FormGroup>
        </div>
      </div>

      <div className="btn-group mt-4">
        <button
          type="button"
          className="btn btn-success"
          onClick={confirmMapping}
        >
          Next: Process &amp; Download →
        </button>
      </div>
    </div>
  );
}

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
