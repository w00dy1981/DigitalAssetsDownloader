import React from 'react';
import { DownloadConfig } from '@/shared/types';
import { ProcessControls, ProgressDisplay, ActivityLog } from './process';
import { useDownloadLifecycle, useDownloadValidation } from '@/renderer/hooks';

interface ProcessTabProps {
  config: DownloadConfig;
  onConfigurationChange: (config: DownloadConfig) => void;
}

const ProcessTab: React.FC<ProcessTabProps> = ({
  config,
  onConfigurationChange,
}) => {
  const { validateDownloadConfig } = useDownloadValidation(config);

  const {
    isDownloading,
    isStartPending,
    isCancelPending,
    progress,
    logs,
    handleStartDownloads,
    handleCancelDownloads,
  } = useDownloadLifecycle({ config, validateDownloadConfig });

  return (
    <div className="tab-panel">
      <div className="process-header-compact">
        <h2>Process & Download</h2>
      </div>

      <div className="process-layout">
        <ProcessControls
          config={config}
          onConfigurationChange={onConfigurationChange}
          isDownloading={isDownloading}
          isStartPending={isStartPending}
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
