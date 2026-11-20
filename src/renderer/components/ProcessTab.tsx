import React from 'react';
import type { DownloadConfig, LoadedInput } from '@/shared/types';
import { ProcessControls, ProgressDisplay, ActivityLog } from './process';
import { useDownloadLifecycle } from './process/useDownloadLifecycle';

interface ProcessTabProps {
  config: DownloadConfig;
  loadId: LoadedInput['loadId'];
  onConfigurationChange: (config: DownloadConfig) => void;
}

const ProcessTab: React.FC<ProcessTabProps> = ({
  config,
  loadId,
  onConfigurationChange,
}) => {
  const {
    isDownloading,
    isCancelPending,
    progress,
    logs,
    handleStartDownloads,
    handleCancelDownloads,
  } = useDownloadLifecycle(config, loadId);

  return (
    <div className="process-tab">
      <div className="process-header-compact">
        <h2 className="screen-title">Process & Download</h2>
      </div>

      <div className="process-layout">
        <ProcessControls
          config={config}
          onConfigurationChange={onConfigurationChange}
          isDownloading={isDownloading}
          isCancelPending={isCancelPending}
          onStartDownloads={handleStartDownloads}
          onCancelDownloads={handleCancelDownloads}
        />

        <div className="process-right">
          <ProgressDisplay progress={progress} isDownloading={isDownloading} />

          <ActivityLog logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default ProcessTab;
