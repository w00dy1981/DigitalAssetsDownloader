import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DownloadConfig,
  DownloadProgress,
  DownloadCompletionEvent,
  IPC_CHANNELS,
} from '@/shared/types';
import { ipcService } from '@/services/IPCService';
import { logger } from '@/services/LoggingService';
import { errorHandler } from '@/services/ErrorHandlingService';

interface UseDownloadLifecycleParams {
  config: DownloadConfig;
  validateDownloadConfig: () => string[];
}

const initialProgressState: DownloadProgress = {
  currentFile: '',
  successful: 0,
  failed: 0,
  total: 0,
  percentage: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
  backgroundProcessed: 0,
};

export const useDownloadLifecycle = ({
  config,
  validateDownloadConfig,
}: UseDownloadLifecycleParams) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isStartPending, setIsStartPending] = useState<boolean>(false);
  const [isCancelPending, setIsCancelPending] = useState<boolean>(false);
  const [progress, setProgress] =
    useState<DownloadProgress>(initialProgressState);
  const [logs, setLogs] = useState<string[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleProgress = (data: DownloadProgress) => {
      logger.debug(
        'useDownloadLifecycle: Progress update received',
        'useDownloadLifecycle',
        data
      );
      setProgress(data);
    };

    const handleComplete = (data: DownloadCompletionEvent) => {
      logger.info(
        'useDownloadLifecycle: Download complete',
        'useDownloadLifecycle',
        data
      );
      setIsDownloading(false);
      setIsStartPending(false);
      setIsCancelPending(false);

      const {
        error,
        cancelled,
        successful = 0,
        failed = 0,
        backgroundProcessed = 0,
        logFile,
      } = data;

      if (error) {
        const errorMessage = `Download error: ${error}`;
        logger.error(
          'useDownloadLifecycle: Download completed with error',
          new Error(error),
          'useDownloadLifecycle'
        );
        setLogs(prev => [...prev, errorMessage]);
      } else if (cancelled) {
        const cancelMessage = `Downloads cancelled: ${successful} successful, ${failed} failed`;
        logger.warn(
          'useDownloadLifecycle: Downloads were cancelled',
          'useDownloadLifecycle',
          {
            successful,
            failed,
          }
        );
        setLogs(prev => [...prev, cancelMessage]);
      } else {
        const messages = [
          `Downloads complete: ${successful} successful, ${failed} failed`,
        ];

        if (backgroundProcessed > 0) {
          messages.push(
            `Background processing: ${backgroundProcessed} images had backgrounds fixed`
          );
        }

        if (logFile) {
          messages.push(`Log file saved: ${logFile}`);
        }

        logger.info(
          'useDownloadLifecycle: Downloads completed successfully',
          'useDownloadLifecycle',
          {
            successful,
            failed,
            backgroundProcessed,
            logFile,
          }
        );
        setLogs(prev => [...prev, ...messages]);
      }
    };

    ipcService.onDownloadProgress(handleProgress);
    ipcService.onDownloadComplete(handleComplete);

    return () => {
      ipcService.cleanup([
        IPC_CHANNELS.DOWNLOAD_PROGRESS,
        IPC_CHANNELS.DOWNLOAD_COMPLETE,
      ]);
    };
  }, []);

  const resetProgressState = useCallback(() => {
    setProgress({ ...initialProgressState });
  }, []);

  const initializeDownloadState = useCallback(() => {
    setIsDownloading(true);
    startTimeRef.current = Date.now();
    resetProgressState();
    setLogs(['Starting downloads...']);
  }, [resetProgressState]);

  const executeDownload = useCallback(async () => {
    const result = await ipcService.startDownloads(config);
    if (result.success) {
      logger.info(
        'useDownloadLifecycle: Download startup successful',
        'useDownloadLifecycle',
        {
          message: result.message,
        }
      );
      setLogs(prev => [...prev, result.message]);
    } else {
      const errorMessage = `Error: ${result.message || 'Unknown error'}`;
      logger.error(
        'useDownloadLifecycle: Download startup failed',
        new Error(result.message || 'Unknown error'),
        'useDownloadLifecycle'
      );
      setLogs(prev => [...prev, errorMessage]);
      setIsDownloading(false);
    }
  }, [config]);

  const handleDownloadError = useCallback((error: unknown) => {
    const handledError = errorHandler.handleError(
      error,
      'ProcessTab.handleStartDownloads'
    );

    const normalizedError =
      handledError instanceof Error
        ? handledError
        : new Error(String(handledError));

    logger.error(
      'useDownloadLifecycle: Error starting downloads',
      normalizedError,
      'useDownloadLifecycle'
    );

    const message = normalizedError.message;

    if (message.includes('Downloads already in progress')) {
      setLogs(prev => [
        ...prev,
        'Downloads already in progress - operation prevented',
      ]);
    } else {
      setLogs(prev => [...prev, `Error starting downloads: ${message}`]);
    }
    setIsDownloading(false);
  }, []);

  const handleStartDownloads = useCallback(() => {
    if (isDownloading || isStartPending) {
      const message = 'Downloads already in progress - please wait';
      logger.warn(
        'useDownloadLifecycle: Download start prevented - already in progress',
        'useDownloadLifecycle'
      );
      setLogs(prev => [...prev, message]);
      return;
    }

    setIsStartPending(true);
    logger.info(
      'useDownloadLifecycle: Starting download process',
      'useDownloadLifecycle',
      { config }
    );

    const validationErrors = validateDownloadConfig();
    if (validationErrors.length > 0) {
      setLogs(prev => [...prev, ...validationErrors]);
      setIsStartPending(false);
      return;
    }

    initializeDownloadState();

    const startDownloads = async () => {
      try {
        await executeDownload();
      } catch (error) {
        handleDownloadError(error);
      } finally {
        setIsStartPending(false);
      }
    };

    void startDownloads();
  }, [
    config,
    executeDownload,
    handleDownloadError,
    initializeDownloadState,
    isDownloading,
    isStartPending,
    validateDownloadConfig,
  ]);

  const handleCancelDownloads = useCallback(() => {
    if (!isDownloading || isCancelPending) {
      const message = 'No downloads currently running';
      logger.warn(
        'useDownloadLifecycle: Cancel requested but no downloads running',
        'useDownloadLifecycle'
      );
      setLogs(prev => [...prev, message]);
      return;
    }

    setIsCancelPending(true);
    logger.info(
      'useDownloadLifecycle: Cancelling downloads',
      'useDownloadLifecycle'
    );
    setLogs(prev => [...prev, 'Cancelling downloads...']);

    const cancelDownloads = async () => {
      try {
        await ipcService.cancelDownloads();
        logger.info(
          'useDownloadLifecycle: Download cancellation requested',
          'useDownloadLifecycle'
        );
        setLogs(prev => [...prev, 'Downloads cancellation requested']);
      } catch (error) {
        const handledError = errorHandler.handleError(
          error,
          'ProcessTab.handleCancelDownloads'
        );
        const normalizedError =
          handledError instanceof Error
            ? handledError
            : new Error(String(handledError));
        setLogs(prev => [
          ...prev,
          `Error cancelling downloads: ${normalizedError.message}`,
        ]);
        setIsDownloading(false);
      } finally {
        setIsCancelPending(false);
      }
    };

    void cancelDownloads();
  }, [isCancelPending, isDownloading]);

  return {
    isDownloading,
    isStartPending,
    isCancelPending,
    progress,
    logs,
    handleStartDownloads,
    handleCancelDownloads,
  };
};
