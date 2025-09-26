import React, { useState, useEffect, useCallback } from 'react';
import {
  DownloadConfig,
  DownloadProgress,
  DownloadCompletionEvent,
  IPC_CHANNELS,
} from '@/shared/types';
import { ProcessControls, ProgressDisplay, ActivityLog } from './process';
import { logger } from '@/services/LoggingService';
import { errorHandler } from '@/services/ErrorHandlingService';
import { ipcService } from '@/services/IPCService';
import { configurationService } from '@/services/ConfigurationService';

interface ProcessTabProps {
  config: DownloadConfig;
  onConfigurationChange: (config: DownloadConfig) => void;
}

const ProcessTab: React.FC<ProcessTabProps> = ({
  config,
  onConfigurationChange,
}) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isStartPending, setIsStartPending] = useState<boolean>(false);
  const [isCancelPending, setIsCancelPending] = useState<boolean>(false);
  const [progress, setProgress] = useState<DownloadProgress>({
    currentFile: '',
    successful: 0,
    failed: 0,
    total: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    backgroundProcessed: 0,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [, setStartTime] = useState<number>(0);

  // IPC event listeners for download progress and completion
  useEffect(() => {
    const handleProgress = (data: DownloadProgress) => {
      logger.debug('ProcessTab: Progress update received', 'ProcessTab', data);
      setProgress(data);
    };

    const handleComplete = (data: DownloadCompletionEvent) => {
      logger.info('ProcessTab: Download complete', 'ProcessTab', data);
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
          'ProcessTab: Download completed with error',
          new Error(error),
          'ProcessTab'
        );
        setLogs(prev => [...prev, errorMessage]);
      } else if (cancelled) {
        const cancelMessage = `Downloads cancelled: ${successful} successful, ${failed} failed`;
        logger.warn('ProcessTab: Downloads were cancelled', 'ProcessTab', {
          successful,
          failed,
        });
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
          'ProcessTab: Downloads completed successfully',
          'ProcessTab',
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

  const validateDownloadConfig = useCallback((): string[] => {
    const validation = configurationService.validateDownloadConfig(config);

    if (!validation.isValid) {
      logger.error(
        'ProcessTab: Download configuration validation failed',
        new Error(validation.errors.join(', ')),
        'ProcessTab'
      );
      return validation.errors.map(error => `Error: ${error}`);
    }

    return [];
  }, [config]);

  const initializeDownloadState = useCallback(() => {
    setIsDownloading(true);
    setStartTime(Date.now());
    setProgress({
      currentFile: '',
      successful: 0,
      failed: 0,
      total: 0,
      percentage: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      backgroundProcessed: 0,
    });
    setLogs(['Starting downloads...']);
  }, []);

  const executeDownload = useCallback(async (): Promise<void> => {
    const result = await ipcService.startDownloads(config);
    if (result.success) {
      logger.info('ProcessTab: Download startup successful', 'ProcessTab', {
        message: result.message,
      });
      setLogs(prev => [...prev, result.message]);
    } else {
      const errorMessage = `Error: ${result.message || 'Unknown error'}`;
      logger.error(
        'ProcessTab: Download startup failed',
        new Error(result.message || 'Unknown error'),
        'ProcessTab'
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

    logger.error(
      'ProcessTab: Error starting downloads',
      handledError instanceof Error
        ? handledError
        : new Error(String(handledError)),
      'ProcessTab'
    );

    // Handle specific race condition errors
    if (handledError.message.includes('Downloads already in progress')) {
      setLogs(prev => [
        ...prev,
        'Downloads already in progress - operation prevented',
      ]);
    } else {
      setLogs(prev => [
        ...prev,
        `Error starting downloads: ${handledError.message}`,
      ]);
    }
    setIsDownloading(false);
  }, []);

  const handleStartDownloads = useCallback(async () => {
    // Atomic check - prevent multiple simultaneous start attempts
    if (isDownloading || isStartPending) {
      const message = 'Downloads already in progress - please wait';
      logger.warn(
        'ProcessTab: Download start prevented - already in progress',
        'ProcessTab'
      );
      setLogs(prev => [...prev, message]);
      return;
    }

    setIsStartPending(true);
    logger.info('ProcessTab: Starting download process', 'ProcessTab', {
      config,
    });

    // Validate configuration
    const validationErrors = validateDownloadConfig();
    if (validationErrors.length > 0) {
      setLogs(prev => [...prev, ...validationErrors]);
      setIsStartPending(false);
      return;
    }

    // Initialize download state
    initializeDownloadState();

    try {
      await executeDownload();
    } catch (error) {
      handleDownloadError(error);
    } finally {
      setIsStartPending(false);
    }
  }, [
    config,
    isDownloading,
    isStartPending,
    validateDownloadConfig,
    initializeDownloadState,
    executeDownload,
    handleDownloadError,
  ]);

  const handleCancelDownloads = useCallback(async () => {
    if (!isDownloading || isCancelPending) {
      const message = 'No downloads currently running';
      logger.warn(
        'ProcessTab: Cancel requested but no downloads running',
        'ProcessTab'
      );
      setLogs(prev => [...prev, message]);
      return;
    }

    setIsCancelPending(true);
    logger.info('ProcessTab: Cancelling downloads', 'ProcessTab');
    setLogs(prev => [...prev, 'Cancelling downloads...']);

    try {
      await ipcService.cancelDownloads();
      logger.info('ProcessTab: Download cancellation requested', 'ProcessTab');
      setLogs(prev => [...prev, 'Downloads cancellation requested']);
    } catch (error) {
      const handledError = errorHandler.handleError(
        error,
        'ProcessTab.handleCancelDownloads'
      );
      setLogs(prev => [
        ...prev,
        `Error cancelling downloads: ${handledError.message}`,
      ]);
      setIsDownloading(false);
    } finally {
      setIsCancelPending(false);
    }
  }, [isDownloading, isCancelPending]);

  return (
    <div className="tab-panel">
      <div className="process-header-compact">
        <h2>Process & Download</h2>
      </div>

      <div className="process-layout">
        {/* Left Column - Configuration and Controls */}
        <ProcessControls
          config={config}
          onConfigurationChange={onConfigurationChange}
          isDownloading={isDownloading}
          isStartPending={isStartPending}
          isCancelPending={isCancelPending}
          onStartDownloads={handleStartDownloads}
          onCancelDownloads={handleCancelDownloads}
        />

        {/* Right Column - Progress and Logs */}
        <div className="process-right">
          <ProgressDisplay progress={progress} isDownloading={isDownloading} />

          <ActivityLog logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default ProcessTab;
