import React, { useState, useCallback } from 'react';
import { SpreadsheetData } from '@/shared/types';

interface FileSelectionTabProps {
  onDataLoaded: (data: SpreadsheetData) => void;
  currentData: SpreadsheetData | null;
}

const FileSelectionTab: React.FC<FileSelectionTabProps> = ({ onDataLoaded, currentData }) => {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleFileSelect = useCallback(async () => {
    try {
      setError('');
      const result = await window.electronAPI.openFileDialog({
        title: 'Select Excel or CSV File',
        filters: [
          { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        setSelectedFile(filePath);
        
        // Load sheet names for Excel files
        if (filePath.toLowerCase().endsWith('.csv')) {
          // CSV files have only one "sheet"
          setAvailableSheets(['Sheet1']);
          setSelectedSheet('Sheet1');
        } else {
          setIsLoading(true);
          try {
            const sheets = await window.electronAPI.getSheetNames(filePath);
            setAvailableSheets(sheets);
            setSelectedSheet(sheets[0] || '');
          } catch (err) {
            setError('Failed to load sheet names from the Excel file.');
            console.error('Error loading sheet names:', err);
          } finally {
            setIsLoading(false);
          }
        }
      }
    } catch (err) {
      setError('Failed to open file dialog.');
      console.error('Error opening file dialog:', err);
    }
  }, []);

  const handleSheetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSheet(e.target.value);
  }, []);

  const handleLoadSheet = useCallback(async () => {
    if (!selectedFile || !selectedSheet) {
      setError('Please select both a file and a sheet.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await window.electronAPI.loadSheetData(selectedFile, selectedSheet);
      
      if (!data || !data.columns || !data.rows) {
        setError('Failed to load data from the selected sheet.');
        return;
      }

      const spreadsheetData: SpreadsheetData = {
        columns: data.columns,
        rows: data.rows,
        sheetName: selectedSheet,
        filePath: selectedFile
      };

      onDataLoaded(spreadsheetData);
    } catch (err) {
      setError('Failed to load sheet data. Please check the file format and try again.');
      console.error('Error loading sheet data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, selectedSheet, onDataLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (!file) return;
    
    // For Electron, we can access the file path
    const filePath = (file as any).path || file.name;
    
    if (!filePath) {
      setError('Unable to get file path.');
      return;
    }
    
    const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
    const hasValidExtension = validExtensions.some(ext => 
      filePath.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      setError('Please select a valid Excel (.xlsx, .xls, .xlsm) or CSV file.');
      return;
    }
    
    setSelectedFile(filePath);
    setError('');
    
    // Load sheet names
    if (filePath.toLowerCase().endsWith('.csv')) {
      setAvailableSheets(['Sheet1']);
      setSelectedSheet('Sheet1');
    } else {
      setIsLoading(true);
      try {
        const sheets = await window.electronAPI.getSheetNames(filePath);
        setAvailableSheets(sheets);
        setSelectedSheet(sheets[0] || '');
      } catch (err) {
        setError('Failed to load sheet names from the Excel file.');
        console.error('Error loading sheet names:', err);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  return (
    <div className="tab-panel">
      <h2>File Selection</h2>
      <p>Select an Excel file (.xlsx, .xls, .xlsm) or CSV file to begin processing.</p>
      
      {error && (
        <div className="alert alert-danger mb-3">
          {error}
        </div>
      )}
      
      {/* File Selection */}
      <div className="form-group">
        <label htmlFor="file-input">Excel or CSV File</label>
        <div 
          className="file-drop-zone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            id="file-input"
            type="text"
            value={selectedFile}
            readOnly
            placeholder="Click 'Browse' to select a file or drag & drop here"
            className="form-control"
          />
          <button 
            type="button" 
            className="btn btn-primary ml-2"
            onClick={handleFileSelect}
            disabled={isLoading}
          >
            Browse...
          </button>
        </div>
        <small className="text-muted">
          Supported formats: .xlsx, .xls, .xlsm, .csv
        </small>
      </div>
      
      {/* Sheet Selection */}
      {selectedFile && availableSheets.length > 0 && (
        <div className="form-group">
          <label htmlFor="sheet-select">Select Sheet</label>
          <select
            id="sheet-select"
            value={selectedSheet}
            onChange={handleSheetChange}
            className="form-control"
            disabled={isLoading}
          >
            <option value="">Choose a sheet...</option>
            {availableSheets.map(sheet => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Load Sheet Button */}
      {selectedFile && selectedSheet && (
        <div className="form-group">
          <button
            type="button"
            className="btn btn-success"
            onClick={handleLoadSheet}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Sheet'}
          </button>
        </div>
      )}
      
      {/* Current Data Summary */}
      {currentData && (
        <div className="data-summary mt-4">
          <h3>Current Data</h3>
          <div className="summary-card">
            <p><strong>File:</strong> {currentData.filePath}</p>
            <p><strong>Sheet:</strong> {currentData.sheetName}</p>
            <p><strong>Columns:</strong> {currentData.columns.length}</p>
            <p><strong>Rows:</strong> {currentData.rows.length}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileSelectionTab;
