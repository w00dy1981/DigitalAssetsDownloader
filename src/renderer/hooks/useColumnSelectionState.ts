import { useReducer, useCallback, useMemo, useEffect } from 'react';
import { SpreadsheetData, DownloadConfig } from '@/shared/types';
import { CONSTANTS } from '@/shared/constants';

interface UseColumnSelectionStateParams {
  data: SpreadsheetData;
  initialConfig: DownloadConfig | null;
  onConfigurationComplete: (config: DownloadConfig) => void;
}

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
  maxWorkers: CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
  error: '',
  backgroundProcessingEnabled: true,
  backgroundMethod: 'smart_detect',
  quality: CONSTANTS.IMAGE.DEFAULT_QUALITY,
  edgeThreshold: CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
};

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
        imageFilePath:
          state.imageFilePath || action.payload.imageFilePath || '',
        pdfFilePath: state.pdfFilePath || action.payload.pdfFilePath || '',
        maxWorkers:
          action.payload.maxWorkers || CONSTANTS.DOWNLOAD.DEFAULT_WORKERS,
        backgroundProcessingEnabled:
          action.payload.backgroundProcessing?.enabled ?? true,
        backgroundMethod:
          action.payload.backgroundProcessing?.method || 'smart_detect',
        quality:
          action.payload.backgroundProcessing?.quality ||
          CONSTANTS.IMAGE.DEFAULT_QUALITY,
        edgeThreshold:
          action.payload.backgroundProcessing?.edgeThreshold ||
          CONSTANTS.IMAGE.DEFAULT_EDGE_THRESHOLD,
      };
    default:
      return state;
  }
};

export const useColumnSelectionState = ({
  data,
  initialConfig,
  onConfigurationComplete,
}: UseColumnSelectionStateParams) => {
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

  const columnOptions = useMemo(
    () => data.columns.map(column => ({ value: column, label: column })),
    [data.columns]
  );

  const setPartNoColumn = useCallback(
    (value: string) => dispatch({ type: 'SET_PART_NO_COLUMN', payload: value }),
    []
  );

  const setImageColumns = useCallback(
    (value: string[]) =>
      dispatch({ type: 'SET_IMAGE_COLUMNS', payload: value }),
    []
  );

  const setPdfColumn = useCallback(
    (value: string) => dispatch({ type: 'SET_PDF_COLUMN', payload: value }),
    []
  );

  const setFilenameColumn = useCallback(
    (value: string) =>
      dispatch({ type: 'SET_FILENAME_COLUMN', payload: value }),
    []
  );

  const setImageFolder = useCallback(
    (value: string) => dispatch({ type: 'SET_IMAGE_FOLDER', payload: value }),
    []
  );

  const setPdfFolder = useCallback(
    (value: string) => dispatch({ type: 'SET_PDF_FOLDER', payload: value }),
    []
  );

  const setSourceImageFolder = useCallback(
    (value: string) =>
      dispatch({ type: 'SET_SOURCE_IMAGE_FOLDER', payload: value }),
    []
  );

  const setImageFilePath = useCallback(
    (value: string) =>
      dispatch({ type: 'SET_IMAGE_FILE_PATH', payload: value }),
    []
  );

  const setPdfFilePath = useCallback(
    (value: string) => dispatch({ type: 'SET_PDF_FILE_PATH', payload: value }),
    []
  );

  const setError = useCallback(
    (value: string) => dispatch({ type: 'SET_ERROR', payload: value }),
    []
  );

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
  }, [setError, imageColumns, imageFolder, partNoColumn, pdfColumn, pdfFolder]);

  const currentConfig = useMemo<DownloadConfig>(
    () => ({
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
    }),
    [
      backgroundMethod,
      backgroundProcessingEnabled,
      data.filePath,
      data.sheetName,
      edgeThreshold,
      filenameColumn,
      imageColumns,
      imageFilePath,
      imageFolder,
      maxWorkers,
      partNoColumn,
      pdfColumn,
      pdfFilePath,
      pdfFolder,
      quality,
      sourceImageFolder,
    ]
  );

  const handleNext = useCallback(() => {
    if (!validateConfiguration()) {
      return;
    }
    onConfigurationComplete(currentConfig);
  }, [currentConfig, onConfigurationComplete, validateConfiguration]);

  useEffect(() => {
    if (initialConfig) {
      dispatch({ type: 'INITIALIZE_FROM_CONFIG', payload: initialConfig });
    }
  }, [initialConfig]);

  return {
    state,
    columnOptions,
    setPartNoColumn,
    setImageColumns,
    setPdfColumn,
    setFilenameColumn,
    setImageFolder,
    setPdfFolder,
    setSourceImageFolder,
    setImageFilePath,
    setPdfFilePath,
    setError,
    error,
    validateConfiguration,
    currentConfig,
    handleNext,
  };
};

export type { ColumnSelectionState };
