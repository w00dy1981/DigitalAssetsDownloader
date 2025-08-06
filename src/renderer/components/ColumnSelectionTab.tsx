import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import { ColumnMappingPanel, FolderConfigurationPanel, NetworkPathsPanel } from './column-selection';

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

  // Memoized column options for Select components
  const columnOptions = useMemo(() => 
    data.columns.map(column => ({ value: column, label: column })),
    [data.columns]
  );

  // Load saved settings on component mount
  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        const settings = await window.electronAPI.loadSettings();
        if (settings?.defaultPaths) {
          // Use saved paths (may be empty if user hasn't configured them)
          setImageFilePath(settings.defaultPaths.imageNetworkPath || '');
          setPdfFilePath(settings.defaultPaths.pdfNetworkPath || '');
        } else {
          // No settings available - start with empty paths
          setImageFilePath('');
          setPdfFilePath('');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Start with empty paths on error
        setImageFilePath('');
        setPdfFilePath('');
      }
    };

    loadSavedSettings();
  }, []); // Run once on mount

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
      // Use network paths from config if available and current paths are empty
      if (initialConfig.imageFilePath && !imageFilePath) {
        setImageFilePath(initialConfig.imageFilePath);
      }
      if (initialConfig.pdfFilePath && !pdfFilePath) {
        setPdfFilePath(initialConfig.pdfFilePath);
      }
      setMaxWorkers(initialConfig.maxWorkers || 5);
      setBackgroundProcessingEnabled(initialConfig.backgroundProcessing?.enabled ?? true);
      setBackgroundMethod(initialConfig.backgroundProcessing?.method || 'smart_detect');
      setQuality(initialConfig.backgroundProcessing?.quality || 95);
      setEdgeThreshold(initialConfig.backgroundProcessing?.edgeThreshold || 30);
    }
  }, [initialConfig, imageFilePath, pdfFilePath]);


  // Save settings whenever network paths change
  const saveNetworkPathSettings = useCallback(async () => {
    try {
      const currentSettings = await window.electronAPI.loadSettings() || {};
      const updatedSettings = {
        ...currentSettings,
        defaultPaths: {
          ...currentSettings.defaultPaths,
          imageNetworkPath: imageFilePath,
          pdfNetworkPath: pdfFilePath
        }
      };
      await window.electronAPI.saveSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [imageFilePath, pdfFilePath]);

  // Save settings when paths change (with debounce to avoid too many saves)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (imageFilePath && pdfFilePath) {
        saveNetworkPathSettings();
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [imageFilePath, pdfFilePath, saveNetworkPathSettings]);

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
        <ColumnMappingPanel
          data={data}
          partNoColumn={partNoColumn}
          onPartNoColumnChange={setPartNoColumn}
          imageColumns={imageColumns}
          onImageColumnsChange={setImageColumns}
          pdfColumn={pdfColumn}
          onPdfColumnChange={setPdfColumn}
          filenameColumn={filenameColumn}
          onFilenameColumnChange={setFilenameColumn}
          columnOptions={columnOptions}
          onValidationError={setError}
        />
        
        <FolderConfigurationPanel
          imageFolder={imageFolder}
          onImageFolderChange={setImageFolder}
          pdfFolder={pdfFolder}
          onPdfFolderChange={setPdfFolder}
          sourceImageFolder={sourceImageFolder}
          onSourceImageFolderChange={setSourceImageFolder}
          onError={setError}
        />
        
        <NetworkPathsPanel
          imageFilePath={imageFilePath}
          onImageFilePathChange={setImageFilePath}
          pdfFilePath={pdfFilePath}
          onPdfFilePathChange={setPdfFilePath}
          onError={setError}
        />
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
