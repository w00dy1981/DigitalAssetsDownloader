import React, { useState, useEffect, useCallback } from 'react';
import { DownloadConfig, DownloadProgress, IPC_CHANNELS } from '@/shared/types';
import { ProcessControls, ProgressDisplay, ActivityLog } from './process';
import { logger } from '@/services/LoggingService';
import { errorHandler } from '@/services/ErrorHandlingService';

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

    const handleComplete = (data: any) => {
      logger.info('ProcessTab: Download complete', 'ProcessTab', data);
      setIsDownloading(false);
      setIsStartPending(false);
      setIsCancelPending(false);

      if (data.error) {
        const errorMessage = `Download error: ${data.error}`;
        logger.error(
          'ProcessTab: Download completed with error',
          new Error(data.error),
          'ProcessTab'
        );
        setLogs(prev => [...prev, errorMessage]);
      } else if (data.cancelled) {
        const cancelMessage = `Downloads cancelled: ${data.successful || 0} successful, ${data.failed || 0} failed`;
        logger.warn('ProcessTab: Downloads were cancelled', 'ProcessTab', {
          successful: data.successful || 0,
          failed: data.failed || 0,
        });
        setLogs(prev => [...prev, cancelMessage]);
      } else {
        const messages = [
          `Downloads complete: ${data.successful || 0} successful, ${data.failed || 0} failed`,
        ];

        if (data.backgroundProcessed > 0) {
          messages.push(
            `Background processing: ${data.backgroundProcessed} images had backgrounds fixed`
          );
        }

        if (data.logFile) {
          messages.push(`Log file saved: ${data.logFile}`);
        }

        logger.info(
          'ProcessTab: Downloads completed successfully',
          'ProcessTab',
          {
            successful: data.successful || 0,
            failed: data.failed || 0,
            backgroundProcessed: data.backgroundProcessed || 0,
            logFile: data.logFile,
          }
        );
        setLogs(prev => [...prev, ...messages]);
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);
    window.electronAPI.onDownloadComplete(handleComplete);

    return () => {
      window.electronAPI.removeAllListeners(
        IPC_CHANNELS.DOWNLOAD_PROGRESS as any
      );
      window.electronAPI.removeAllListeners(
        IPC_CHANNELS.DOWNLOAD_COMPLETE as any
      );
    };
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
    if (!config.partNoColumn) {
      const message = 'Error: Please select a Part Number column';
      logger.error(
        'ProcessTab: Validation failed - missing part number column',
        new Error(message),
        'ProcessTab'
      );
      setLogs(prev => [...prev, message]);
      setIsStartPending(false);
      return;
    }

    if (!config.imageColumns.length && !config.pdfColumn) {
      const message =
        'Error: Please select at least one Image URL column or PDF column';
      logger.error(
        'ProcessTab: Validation failed - no columns selected',
        new Error(message),
        'ProcessTab'
      );
      setLogs(prev => [...prev, message]);
      setIsStartPending(false);
      return;
    }

    if (!config.imageFolder && !config.pdfFolder) {
      const message = 'Error: Please select download folders';
      logger.error(
        'ProcessTab: Validation failed - no download folders',
        new Error(message),
        'ProcessTab'
      );
      setLogs(prev => [...prev, message]);
      setIsStartPending(false);
      return;
    }

    // Set downloading state immediately to prevent race conditions
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

    try {
      await window.electronAPI.startDownloads(config);
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
    } catch (error) {
      const handledError = errorHandler.handleError(
        error,
        'ProcessTab.handleStartDownloads'
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
    } finally {
      setIsStartPending(false);
    }
  }, [config, isDownloading, isStartPending]);

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
      await window.electronAPI.cancelDownloads();
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

  // Initialize default ERP paths when component mounts (only if empty)
  useEffect(() => {
    // Set default paths only if they are empty/undefined
    const updates: Partial<DownloadConfig> = {};

    // Keep paths empty if not configured - don't auto-assign hardcoded defaults
    // Users should configure these in Settings if needed

    // Only update if there are changes to avoid infinite re-renders
    if (Object.keys(updates).length > 0) {
      onConfigurationChange({ ...config, ...updates });
    }
  }, []);

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
