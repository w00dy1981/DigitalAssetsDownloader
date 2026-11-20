import { useEffect, useState } from 'react';
import type { LoadedInput } from '@/shared/types';
import type { DownloadProgress } from '@/download/downloadRun';

export function useDownloadLifecycle({ options, loadId }: LoadedInput) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'cancelling'>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
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
    setProgress(null);
    setLogs(['Starting downloads...']);
    try {
      await window.electronAPI.startDownloads(options, loadId);
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
    phase,
    progress,
    logs,
    handleStartDownloads,
    handleCancelDownloads,
  };
}
