import { useState } from 'react';
import type { LoadedInput } from '@/shared/types';
import { FileInput } from './input/FileInput';
import { SqlInput } from './input/SqlInput';

interface InputSelectionTabProps {
  onDataLoaded: (data: LoadedInput) => void;
  currentData: LoadedInput | null;
}

export interface InputWorkflowProps {
  onDataLoaded: (data: LoadedInput) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (message: string) => void;
}

const InputSelectionTab: React.FC<InputSelectionTabProps> = ({
  onDataLoaded,
  currentData,
}) => {
  const [mode, setMode] = useState<'file' | 'sql'>('file');
  const [loading, setLoading] = useState(false);
  const [fileLoadId, setFileLoadId] = useState(0);
  const [error, setError] = useState('');
  const workflow = { onDataLoaded, loading, setLoading, setError };

  return (
    <div className="input-tab">
      <h2 className="screen-title">Input Selection</h2>
      {error && (
        <div role="alert" className="alert alert-danger mb-3">
          {error}
        </div>
      )}
      <div className="form-group">
        <div className="btn-group" role="group" aria-label="Input type">
          {(['file', 'sql'] as const).map(source => (
            <button
              key={source}
              type="button"
              className={`btn ${mode === source ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={mode === source}
              disabled={loading}
              onClick={() => {
                if (mode === source) return;
                setError('');
                setMode(source);
              }}
            >
              {source === 'file' ? 'Excel / CSV' : 'SQL Server'}
            </button>
          ))}
        </div>
      </div>

      <div hidden={mode !== 'file'}>
        <FileInput
          {...workflow}
          onDataLoaded={data => {
            setFileLoadId(data.loadId);
            onDataLoaded(data);
          }}
        />
      </div>
      <div hidden={mode !== 'sql'}>
        <SqlInput
          {...workflow}
          fileLoadId={fileLoadId}
          active={mode === 'sql'}
        />
      </div>

      {currentData && (
        <div className="data-summary mt-4">
          <h3>Loaded Data Summary</h3>
          <div className="summary-card">
            <p>
              <strong>Input Source:</strong> {currentData.sourceLabel}
            </p>
            <p>
              <strong>Dataset:</strong> {currentData.sheetName}
            </p>
            <p>
              <strong>Columns:</strong> {currentData.columns.length} (
              {currentData.columns.slice(0, 3).join(', ')}
              {currentData.columns.length > 3 ? '...' : ''})
            </p>
            <p>
              <strong>Rows:</strong> {currentData.rowCount} data rows
            </p>
            <p className="text-success">
              <strong>Status:</strong> Ready for column mapping
            </p>
          </div>
        </div>
      )}

      {loading && (
        <p role="status" className="text-center text-info mt-3">
          Loading input data...
        </p>
      )}
    </div>
  );
};

export default InputSelectionTab;
