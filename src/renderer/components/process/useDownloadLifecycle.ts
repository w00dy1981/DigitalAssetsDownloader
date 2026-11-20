import { useEffect, useState } from 'react';
import type { DownloadConfig } from '@/shared/types';
import type { DownloadProgress } from '@/download/downloadRun';

const initialProgress: DownloadProgress = {
  currentFile: '',
  successful: 0,
  failed: 0,
  total: 0,
  percentage: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
  backgroundProcessed: 0,
};

export function useDownloadLifecycle(config: DownloadConfig) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'cancelling'>('idle');
  const [progress, setProgress] = useState(initialProgress);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeProgress =
      window.electronAPI.onDownloadProgress(setProgress);
    const unsubscribeComplete = window.electronAPI.onDownloadComplete(
      result => {
        setPhase('idle');
        if (result.error) {
          setLogs(previous => [...previous, `Download error: ${result.error}`]);
          return;
        }
        const summary = `Downloads ${result.cancelled ? 'cancelled' : 'complete'}: ${result.successful} successful, ${result.failed} failed`;
        setLogs(previous => [
          ...previous,
          summary,
          ...(result.backgroundProcessed
            ? [`Background processing: ${result.backgroundProcessed} images`]
            : []),
          ...(result.logFile ? [`Log file saved: ${result.logFile}`] : []),
        ]);
      }
    );
    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, []);

  async function handleStartDownloads() {
    if (phase !== 'idle') return;
    setPhase('running');
    setProgress(initialProgress);
    setLogs(['Starting downloads...']);
    try {
      await window.electronAPI.startDownloads(config);
    } catch (error) {
      setPhase('idle');
      setLogs(previous => [
        ...previous,
        `Error starting downloads: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }
  async function handleCancelDownloads() {
    if (phase !== 'running') return;
    setPhase('cancelling');
    setLogs(previous => [...previous, 'Cancelling downloads...']);
    try {
      await window.electronAPI.cancelDownloads();
    } catch (error) {
      setPhase('running');
      setLogs(previous => [
        ...previous,
        `Error cancelling downloads: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }
  return {
    isDownloading: phase !== 'idle',
    isCancelPending: phase === 'cancelling',
    progress,
    logs,
    handleStartDownloads,
    handleCancelDownloads,
  };
}
