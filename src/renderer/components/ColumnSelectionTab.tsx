import React, { useState, useEffect, useCallback } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';

interface ColumnSelectionTabProps {
  data: SpreadsheetData;
  onConfigurationComplete: (config: DownloadConfig) => void;
  initialConfig: DownloadConfig | null;
}

const ColumnSelectionTab: React.FC<ColumnSelectionTabProps> = ({ 
  data, 
  onConfigurationComplete, 
  initialConfig 
}) => {
  const [partNoColumn, setPartNoColumn] = useState<string>('');
  const [imageColumns, setImageColumns] = useState<string[]>([]);
  const [pdfColumn, setPdfColumn] = useState<string>('');
  const [filenameColumn, setFilenameColumn] = useState<string>('');
  const [imageFolder, setImageFolder] = useState<string>('');
  const [pdfFolder, setPdfFolder] = useState<string>('');
  const [sourceImageFolder, setSourceImageFolder] = useState<string>('');
  const [imageFilePath, setImageFilePath] = useState<string>('');
  const [pdfFilePath, setPdfFilePath] = useState<string>('');
  const [maxWorkers, setMaxWorkers] = useState<number>(5);
  const [error, setError] = useState<string>('');

  // Background processing settings
  const [backgroundProcessingEnabled, setBackgroundProcessingEnabled] = useState<boolean>(true);
  const [backgroundMethod, setBackgroundMethod] = useState<'smart_detect' | 'ai_removal' | 'color_replace' | 'edge_detection'>('smart_detect');
  const [quality, setQuality] = useState<number>(95);
  const [edgeThreshold, setEdgeThreshold] = useState<number>(30);

  // Load initial configuration with defaults
  useEffect(() => {
    if (initialConfig) {
      setPartNoColumn(initialConfig.partNoColumn || '');
      setImageColumns(initialConfig.imageColumns || []);
      setPdfColumn(initialConfig.pdfColumn || '');
      setFilenameColumn(initialConfig.filenameColumn || '');
      setImageFolder(initialConfig.imageFolder || '');
      setPdfFolder(initialConfig.pdfFolder || '');
      setSourceImageFolder(initialConfig.sourceImageFolder || '');
      setImageFilePath(initialConfig.imageFilePath || "U:\\old_g\\IMAGES\\ABM Product Images");
      setPdfFilePath(initialConfig.pdfFilePath || "U:\\old_g\\IMAGES\\Product pdf's");
      setMaxWorkers(initialConfig.maxWorkers || 5);
      setBackgroundProcessingEnabled(initialConfig.backgroundProcessing?.enabled ?? true);
      setBackgroundMethod(initialConfig.backgroundProcessing?.method || 'smart_detect');
      setQuality(initialConfig.backgroundProcessing?.quality || 95);
      setEdgeThreshold(initialConfig.backgroundProcessing?.edgeThreshold || 30);
    } else {
      // Set defaults when no initial config
      setImageFilePath("U:\\old_g\\IMAGES\\ABM Product Images");
      setPdfFilePath("U:\\old_g\\IMAGES\\Product pdf's");
    }
  }, [initialConfig]);

  const handleFolderSelect = useCallback(async (setter: (value: string) => void) => {
    try {
      const result = await window.electronAPI.openFolderDialog({
        title: 'Select Folder'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        setter(result.filePaths[0]);
      }
    } catch (err) {
      setError('Failed to open folder dialog.');
      console.error('Error opening folder dialog:', err);
    }
  }, []);

  const validateConfiguration = useCallback((): boolean => {
    setError('');
    
    if (!partNoColumn) {
      setError('Please select a Part Number column.');
      return false;
    }
    
    if (imageColumns.length === 0 && !pdfColumn) {
      setError('Please select at least one Image URL column or PDF column.');
      return false;
    }
    
    if (imageColumns.length > 0 && !imageFolder) {
      setError('Please select an image download folder.');
      return false;
    }
    
    if (pdfColumn && !pdfFolder) {
      setError('Please select a PDF download folder.');
      return false;
    }
    
    return true;
  }, [partNoColumn, imageColumns, pdfColumn, imageFolder, pdfFolder]);

  const handleNext = useCallback(() => {
    if (!validateConfiguration()) {
      return;
    }
    
    const config: DownloadConfig = {
      excelFile: data.filePath,
      sheetName: data.sheetName,
      partNoColumn,
      imageColumns,
      pdfColumn,
      filenameColumn,
      imageFolder,
      pdfFolder,
      sourceImageFolder,
      imageFilePath,
      pdfFilePath,
      maxWorkers,
      backgroundProcessing: {
        enabled: backgroundProcessingEnabled,
        method: backgroundMethod,
        quality,
        edgeThreshold
      }
    };
    
    onConfigurationComplete(config);
  }, [
    data, partNoColumn, imageColumns, pdfColumn, filenameColumn,
    imageFolder, pdfFolder, sourceImageFolder, imageFilePath, pdfFilePath,
    maxWorkers, backgroundProcessingEnabled, backgroundMethod, quality, edgeThreshold,
    onConfigurationComplete, validateConfiguration
  ]);

  return (
    <div className="tab-panel">
      <h2>Column Selection & Configuration</h2>
      <p>Map your Excel columns to the appropriate data types and configure download settings.</p>
      <p className="data-info">
        <strong>Loaded Data:</strong> {data.sheetName} ({data.rows.length} rows, {data.columns.length} columns)
      </p>
      
      {error && (
        <div className="alert alert-danger mb-3">
          {error}
        </div>
      )}
      
      <div className="configuration-sections">
        {/* Column Mapping Section */}
        <div className="config-section">
          <h3>Column Mapping</h3>
          
          {/* Part Number Column (Required) */}
          <div className="form-group">
            <label htmlFor="part-column">Part Number Column *</label>
            <select
              id="part-column"
              value={partNoColumn}
              onChange={(e) => setPartNoColumn(e.target.value)}
              className="form-control"
            >
              <option value="">Choose a column...</option>
              {data.columns.map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
          
          {/* Image URL Columns */}
          <div className="form-group">
            <label htmlFor="image-column">Image URL Column</label>
            <select
              id="image-column"
              value={imageColumns[0] || ''}
              onChange={(e) => setImageColumns(e.target.value ? [e.target.value] : [])}
              className="form-control"
            >
              <option value="">Choose a column...</option>
              {data.columns.map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <small className="text-muted">
              Select the column containing image URLs
            </small>
          </div>
          
          {/* PDF Column */}
          <div className="form-group">
            <label htmlFor="pdf-column">PDF URL Column</label>
            <select
              id="pdf-column"
              value={pdfColumn}
              onChange={(e) => setPdfColumn(e.target.value)}
              className="form-control"
            >
              <option value="">Choose a column...</option>
              {data.columns.map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
          
          {/* Filename Column */}
          <div className="form-group">
            <label htmlFor="filename-column">Custom Filename Column (Optional)</label>
            <select
              id="filename-column"
              value={filenameColumn}
              onChange={(e) => setFilenameColumn(e.target.value)}
              className="form-control"
            >
              <option value="">Choose a column...</option>
              {data.columns.map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <small className="text-muted">
              Used for filename matching when searching source folders
            </small>
          </div>
        </div>
        
        {/* Download Folders Section */}
        <div className="config-section">
          <h3>Download Folders</h3>
          
          {/* Image Download Folder */}
          <div className="form-group">
            <label htmlFor="image-folder">Image Download Folder</label>
            <div className="folder-input-group">
              <input
                id="image-folder"
                type="text"
                value={imageFolder}
                onChange={(e) => setImageFolder(e.target.value)}
                placeholder="Select folder for downloaded images"
                className="form-control"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleFolderSelect(setImageFolder)}
              >
                Browse
              </button>
            </div>
          </div>
          
          {/* PDF Download Folder */}
          <div className="form-group">
            <label htmlFor="pdf-folder">PDF Download Folder</label>
            <div className="folder-input-group">
              <input
                id="pdf-folder"
                type="text"
                value={pdfFolder}
                onChange={(e) => setPdfFolder(e.target.value)}
                placeholder="Select folder for downloaded PDFs"
                className="form-control"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleFolderSelect(setPdfFolder)}
              >
                Browse
              </button>
            </div>
          </div>
          
          {/* Source Image Folder */}
          <div className="form-group">
            <label htmlFor="source-folder">Source Image Folder (Optional)</label>
            <div className="folder-input-group">
              <input
                id="source-folder"
                type="text"
                value={sourceImageFolder}
                onChange={(e) => setSourceImageFolder(e.target.value)}
                placeholder="Folder to search for existing images"
                className="form-control"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleFolderSelect(setSourceImageFolder)}
              >
                Browse
              </button>
            </div>
            <small className="text-muted">
              If specified, the system will search this folder for images matching part numbers
            </small>
          </div>
          
          {/* Network Path Configuration */}
          <div className="form-group">
            <label htmlFor="image-network-path">Image Network Path (for CSV logging)</label>
            <input
              id="image-network-path"
              type="text"
              value={imageFilePath}
              onChange={(e) => setImageFilePath(e.target.value)}
              placeholder="Network path for image files in CSV log (e.g., \\server\images\)"
              className="form-control"
            />
            <small className="text-muted">
              Network path that will be logged in CSV reports (separate from local download path)
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="pdf-network-path">PDF Network Path (for CSV logging)</label>
            <input
              id="pdf-network-path"
              type="text"
              value={pdfFilePath}
              onChange={(e) => setPdfFilePath(e.target.value)}
              placeholder="Network path for PDF files in CSV log (e.g., \\server\pdfs\)"
              className="form-control"
            />
            <small className="text-muted">
              Network path that will be logged in CSV reports (separate from local download path)
            </small>
          </div>
        </div>
      </div>
      
      <div className="btn-group mt-4">
        <button
          type="button"
          className="btn btn-success"
          onClick={handleNext}
        >
          Next: Process & Download →
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.electronAPI.saveConfig({
            excelFile: data.filePath,
            sheetName: data.sheetName,
            partNoColumn,
            imageColumns,
            pdfColumn,
            filenameColumn,
            imageFolder,
            pdfFolder,
            sourceImageFolder,
            imageFilePath,
            pdfFilePath,
            maxWorkers,
            backgroundProcessing: {
              enabled: backgroundProcessingEnabled,
              method: backgroundMethod,
              quality,
              edgeThreshold
            }
          })}
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};

export default ColumnSelectionTab;
