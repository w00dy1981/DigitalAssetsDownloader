import React, { useReducer, useEffect, useCallback, useMemo } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';

// State interface for useReducer
interface ColumnSelectionState {
  partNoColumn: string;
  imageColumns: string[];
  pdfColumn: string;
  filenameColumn: string;
  imageFolder: string;
  pdfFolder: string;
  sourceImageFolder: string;
  imageFilePath: string;
  pdfFilePath: string;
  maxWorkers: number;
  error: string;
  backgroundProcessingEnabled: boolean;
  backgroundMethod: 'smart_detect';
  quality: number;
  edgeThreshold: number;
}

// Action types
type ColumnSelectionAction =
  | { type: 'SET_PART_NO_COLUMN'; payload: string }
  | { type: 'SET_IMAGE_COLUMNS'; payload: string[] }
  | { type: 'SET_PDF_COLUMN'; payload: string }
  | { type: 'SET_FILENAME_COLUMN'; payload: string }
  | { type: 'SET_IMAGE_FOLDER'; payload: string }
  | { type: 'SET_PDF_FOLDER'; payload: string }
  | { type: 'SET_SOURCE_IMAGE_FOLDER'; payload: string }
  | { type: 'SET_IMAGE_FILE_PATH'; payload: string }
  | { type: 'SET_PDF_FILE_PATH'; payload: string }
  | { type: 'SET_MAX_WORKERS'; payload: number }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_BACKGROUND_PROCESSING_ENABLED'; payload: boolean }
  | { type: 'SET_BACKGROUND_METHOD'; payload: 'smart_detect' }
  | { type: 'SET_QUALITY'; payload: number }
  | { type: 'SET_EDGE_THRESHOLD'; payload: number }
  | { type: 'INITIALIZE_FROM_CONFIG'; payload: DownloadConfig };

// Initial state
const initialState: ColumnSelectionState = {
  partNoColumn: '',
  imageColumns: [],
  pdfColumn: '',
  filenameColumn: '',
  imageFolder: '',
  pdfFolder: '',
  sourceImageFolder: '',
  imageFilePath: '',
  pdfFilePath: '',
  maxWorkers: 5,
  error: '',
  backgroundProcessingEnabled: true,
  backgroundMethod: 'smart_detect',
  quality: 95,
  edgeThreshold: 30,
};

// Reducer function
const columnSelectionReducer = (
  state: ColumnSelectionState,
  action: ColumnSelectionAction
): ColumnSelectionState => {
  switch (action.type) {
    case 'SET_PART_NO_COLUMN':
      return { ...state, partNoColumn: action.payload };
    case 'SET_IMAGE_COLUMNS':
      return { ...state, imageColumns: action.payload };
    case 'SET_PDF_COLUMN':
      return { ...state, pdfColumn: action.payload };
    case 'SET_FILENAME_COLUMN':
      return { ...state, filenameColumn: action.payload };
    case 'SET_IMAGE_FOLDER':
      return { ...state, imageFolder: action.payload };
    case 'SET_PDF_FOLDER':
      return { ...state, pdfFolder: action.payload };
    case 'SET_SOURCE_IMAGE_FOLDER':
      return { ...state, sourceImageFolder: action.payload };
    case 'SET_IMAGE_FILE_PATH':
      return { ...state, imageFilePath: action.payload };
    case 'SET_PDF_FILE_PATH':
      return { ...state, pdfFilePath: action.payload };
    case 'SET_MAX_WORKERS':
      return { ...state, maxWorkers: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_BACKGROUND_PROCESSING_ENABLED':
      return { ...state, backgroundProcessingEnabled: action.payload };
    case 'SET_BACKGROUND_METHOD':
      return { ...state, backgroundMethod: action.payload };
    case 'SET_QUALITY':
      return { ...state, quality: action.payload };
    case 'SET_EDGE_THRESHOLD':
      return { ...state, edgeThreshold: action.payload };
    case 'INITIALIZE_FROM_CONFIG':
      return {
        ...state,
        partNoColumn: action.payload.partNoColumn || '',
        imageColumns: action.payload.imageColumns || [],
        pdfColumn: action.payload.pdfColumn || '',
        filenameColumn: action.payload.filenameColumn || '',
        imageFolder: action.payload.imageFolder || '',
        pdfFolder: action.payload.pdfFolder || '',
        sourceImageFolder: action.payload.sourceImageFolder || '',
        imageFilePath: action.payload.imageFilePath || '',
        pdfFilePath: action.payload.pdfFilePath || '',
        maxWorkers: action.payload.maxWorkers || 5,
        backgroundProcessingEnabled: action.payload.backgroundProcessing?.enabled ?? true,
        backgroundMethod: action.payload.backgroundProcessing?.method || 'smart_detect',
        quality: action.payload.backgroundProcessing?.quality || 95,
        edgeThreshold: action.payload.backgroundProcessing?.edgeThreshold || 30,
      };
    default:
      return state;
  }
};
import {
  ColumnMappingPanel,
  FolderConfigurationPanel,
  NetworkPathsPanel,
} from './column-selection';

interface ColumnSelectionTabProps {
  data: SpreadsheetData;
  onConfigurationComplete: (config: DownloadConfig) => void;
  initialConfig: DownloadConfig | null;
}

const ColumnSelectionTab: React.FC<ColumnSelectionTabProps> = ({
  data,
  onConfigurationComplete,
  initialConfig,
}) => {
  const [state, dispatch] = useReducer(columnSelectionReducer, initialState);
  
  const {
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
    error,
    backgroundProcessingEnabled,
    backgroundMethod,
    quality,
    edgeThreshold,
  } = state;

  // Wrapper functions for component props
  const setPartNoColumn = useCallback((value: string) => 
    dispatch({ type: 'SET_PART_NO_COLUMN', payload: value }), []);
  const setImageColumns = useCallback((value: string[]) => 
    dispatch({ type: 'SET_IMAGE_COLUMNS', payload: value }), []);
  const setPdfColumn = useCallback((value: string) => 
    dispatch({ type: 'SET_PDF_COLUMN', payload: value }), []);
  const setFilenameColumn = useCallback((value: string) => 
    dispatch({ type: 'SET_FILENAME_COLUMN', payload: value }), []);
  const setImageFolder = useCallback((value: string) => 
    dispatch({ type: 'SET_IMAGE_FOLDER', payload: value }), []);
  const setPdfFolder = useCallback((value: string) => 
    dispatch({ type: 'SET_PDF_FOLDER', payload: value }), []);
  const setSourceImageFolder = useCallback((value: string) => 
    dispatch({ type: 'SET_SOURCE_IMAGE_FOLDER', payload: value }), []);
  const setImageFilePath = useCallback((value: string) => 
    dispatch({ type: 'SET_IMAGE_FILE_PATH', payload: value }), []);
  const setPdfFilePath = useCallback((value: string) => 
    dispatch({ type: 'SET_PDF_FILE_PATH', payload: value }), []);
  const setError = useCallback((value: string) => 
    dispatch({ type: 'SET_ERROR', payload: value }), []);

  // Memoized column options for Select components
  const columnOptions = useMemo(
    () => data.columns.map(column => ({ value: column, label: column })),
    [data.columns]
  );

  // Load saved settings on component mount
  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        const settings = await window.electronAPI.loadSettings();
        if (settings?.defaultPaths) {
          // Use saved paths (may be empty if user hasn't configured them)
          dispatch({ type: 'SET_IMAGE_FILE_PATH', payload: settings.defaultPaths.imageNetworkPath || '' });
          dispatch({ type: 'SET_PDF_FILE_PATH', payload: settings.defaultPaths.pdfNetworkPath || '' });
        } else {
          // No settings available - start with empty paths
          dispatch({ type: 'SET_IMAGE_FILE_PATH', payload: '' });
          dispatch({ type: 'SET_PDF_FILE_PATH', payload: '' });
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
      dispatch({ type: 'SET_PART_NO_COLUMN', payload: initialConfig.partNoColumn || '' });
      dispatch({ type: 'SET_IMAGE_COLUMNS', payload: initialConfig.imageColumns || [] });
      dispatch({ type: 'SET_PDF_COLUMN', payload: initialConfig.pdfColumn || '' });
      dispatch({ type: 'SET_FILENAME_COLUMN', payload: initialConfig.filenameColumn || '' });
      dispatch({ type: 'SET_IMAGE_FOLDER', payload: initialConfig.imageFolder || '' });
      dispatch({ type: 'SET_PDF_FOLDER', payload: initialConfig.pdfFolder || '' });
      dispatch({ type: 'SET_SOURCE_IMAGE_FOLDER', payload: initialConfig.sourceImageFolder || '' });
      // Use network paths from config if available and current paths are empty
      if (initialConfig.imageFilePath && !imageFilePath) {
        dispatch({ type: 'SET_IMAGE_FILE_PATH', payload: initialConfig.imageFilePath });
      }
      if (initialConfig.pdfFilePath && !pdfFilePath) {
        dispatch({ type: 'SET_PDF_FILE_PATH', payload: initialConfig.pdfFilePath });
      }
      dispatch({ type: 'SET_MAX_WORKERS', payload: initialConfig.maxWorkers || 5 });
      dispatch({ type: 'SET_BACKGROUND_PROCESSING_ENABLED', payload: initialConfig.backgroundProcessing?.enabled ?? true });
      dispatch({ type: 'SET_BACKGROUND_METHOD', payload: initialConfig.backgroundProcessing?.method || 'smart_detect' });
      dispatch({ type: 'SET_QUALITY', payload: initialConfig.backgroundProcessing?.quality || 95 });
      dispatch({ type: 'SET_EDGE_THRESHOLD', payload: initialConfig.backgroundProcessing?.edgeThreshold || 30 });
    }
  }, [initialConfig, imageFilePath, pdfFilePath]);

  // Save settings whenever network paths change
  const saveNetworkPathSettings = useCallback(async () => {
    try {
      const currentSettings = (await window.electronAPI.loadSettings()) || {};
      const updatedSettings = {
        ...currentSettings,
        defaultPaths: {
          ...currentSettings.defaultPaths,
          imageNetworkPath: imageFilePath,
          pdfNetworkPath: pdfFilePath,
        },
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
    dispatch({ type: 'SET_ERROR', payload: '' });

    if (!partNoColumn) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select a Part Number column.' });
      return false;
    }

    if (imageColumns.length === 0 && !pdfColumn) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select at least one Image URL column or PDF column.' });
      return false;
    }

    if (imageColumns.length > 0 && !imageFolder) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select an image download folder.' });
      return false;
    }

    if (pdfColumn && !pdfFolder) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select a PDF download folder.' });
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
        edgeThreshold,
      },
    };

    onConfigurationComplete(config);
  }, [
    data,
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
    backgroundProcessingEnabled,
    backgroundMethod,
    quality,
    edgeThreshold,
    onConfigurationComplete,
    validateConfiguration,
  ]);

  return (
    <div className="tab-panel">
      <h2>Column Selection & Configuration</h2>
      <p>
        Map your Excel columns to the appropriate data types and configure
        download settings.
      </p>
      <p className="data-info">
        <strong>Loaded Data:</strong> {data.sheetName} ({data.rows.length} rows,{' '}
        {data.columns.length} columns)
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

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
        <button type="button" className="btn btn-success" onClick={handleNext}>
          Next: Process & Download →
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            window.electronAPI.saveConfig({
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
                edgeThreshold,
              },
            })
          }
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};

export default ColumnSelectionTab;
