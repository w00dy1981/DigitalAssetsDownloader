import { useState, type DragEvent } from 'react';
import type { InputWorkflowProps } from '../FileSelectionTab';

const fileExtensions = ['xlsx', 'xls', 'xlsm', 'csv'];

interface SelectedFile {
  path: string;
  sheets: string[];
  sheet: string;
}

export function FileInput({
  onDataLoaded,
  loading,
  setLoading,
  setError,
}: InputWorkflowProps) {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function selectFile(path: string) {
    setFile({ path, sheets: [], sheet: '' });
    try {
      const sheets = await window.electronAPI.getSheetNames(path);
      setFile({ path, sheets, sheet: sheets[0] ?? '' });
    } catch {
      setError('Failed to read the selected spreadsheet.');
    }
  }

  async function browse() {
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.openFileDialog({
        title: 'Select Excel or CSV File',
        properties: ['openFile'],
        filters: [
          { name: 'All Supported Files', extensions: fileExtensions },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!result.canceled && result.filePaths[0]) {
        await selectFile(result.filePaths[0]);
      }
    } catch {
      setError('Failed to open file dialog.');
    } finally {
      setLoading(false);
    }
  }

  function updateDrag(e: DragEvent, over: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(over && !loading);
  }

  async function drop(e: DragEvent) {
    updateDrag(e, false);
    const dropped = e.dataTransfer.files[0];
    if (loading || !dropped) return;

    const path =
      'path' in dropped && dropped.path ? dropped.path : dropped.name;
    if (typeof path !== 'string' || !path.trim()) {
      setError('Unable to get valid file path.');
      return;
    }
    if (path.includes('..') || path.includes('\0')) {
      setError('Invalid file path detected.');
      return;
    }
    if (!fileExtensions.some(ext => path.toLowerCase().endsWith(`.${ext}`))) {
      setError('Please select a valid Excel (.xlsx, .xls, .xlsm) or CSV file.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await selectFile(path);
    } finally {
      setLoading(false);
    }
  }

  async function loadSheet() {
    if (!file?.sheet) return;

    setLoading(true);
    setError('');
    try {
      const data = await window.electronAPI.loadSheetData(
        file.path,
        file.sheet
      );
      onDataLoaded({
        columns: data.columns,
        rows: data.rows,
        sheetName: file.sheet,
        filePath: file.path,
        sourceType: 'file',
        sourceLabel: file.path,
      });
    } catch {
      setError(
        'Failed to load sheet data. Please check the file format and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="form-group">
        <label htmlFor="file-input">Excel or CSV File</label>
        <div
          className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => updateDrag(e, true)}
          onDragLeave={e => updateDrag(e, false)}
          onDrop={drop}
        >
          <input
            id="file-input"
            type="text"
            value={file?.path ?? ''}
            readOnly
            placeholder="Browse for a file or drag it here"
            className="form-control"
          />
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={browse}
            disabled={loading}
          >
            Browse...
          </button>
        </div>
        <small className="text-muted">
          Supported formats: .xlsx, .xls, .xlsm and .csv
        </small>
      </div>

      {file && file.sheets.length > 0 && (
        <div className="form-group">
          <label htmlFor="sheet-select">Select Sheet</label>
          <select
            id="sheet-select"
            value={file.sheet}
            onChange={e => setFile({ ...file, sheet: e.target.value })}
            className="form-control"
            disabled={loading}
          >
            <option value="">Choose a sheet...</option>
            {file.sheets.map(sheet => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
      )}

      {file?.sheet && (
        <button
          type="button"
          className="btn btn-success"
          onClick={loadSheet}
          disabled={loading}
        >
          Load Sheet
        </button>
      )}
    </>
  );
}
