import React from 'react';
import { DownloadProgress } from '@/shared/types';
import { logger } from '@/services/LoggingService';

interface ProgressDisplayProps {
  progress: DownloadProgress;
  isDownloading: boolean;
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  progress,
  isDownloading,
}) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getProgressBarClass = (): string => {
    if (progress.total === 0) return '';
    
    const successRate = progress.successful / progress.total;
    if (successRate >= 0.9) return 'success';
    if (successRate >= 0.7) return 'warning';
    return 'danger';
  };

  // Only render if there's something to show
  if (!isDownloading && progress.total === 0 && progress.successful === 0 && progress.failed === 0) {
    return null;
  }

  logger.debug('ProgressDisplay: Rendering progress', 'ProgressDisplay', {
    percentage: progress.percentage,
    successful: progress.successful,
    failed: progress.failed,
    total: progress.total,
  });

  return (
    <div className="progress-section">
      <h3>Download Progress</h3>
      
      <div className="progress-summary">
        <div className="summary-stats">
          <div className="stat-card success">
            <div className="stat-number">{progress.successful}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card failed">
            <div className="stat-number">{progress.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card total">
            <div className="stat-number">{progress.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card percentage">
            <div className="stat-number">{progress.percentage.toFixed(1)}%</div>
            <div className="stat-label">Complete</div>
          </div>
          {progress.backgroundProcessed > 0 && (
            <div className="stat-card processed">
              <div className="stat-number">{progress.backgroundProcessed}</div>
              <div className="stat-label">Background Fixed</div>
            </div>
          )}
        </div>
      </div>
      
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className={`progress-fill ${getProgressBarClass()}`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        
        <div className="progress-stats">
          <div className="stat">
            <span>{formatTime(progress.elapsedTime)} elapsed</span>
          </div>
          {progress.estimatedTimeRemaining > 0 && (
            <div className="stat">
              <span>{formatTime(progress.estimatedTimeRemaining)} remaining</span>
            </div>
          )}
          {isDownloading && (
            <div className="stat">
              <span className="downloading-indicator">⬇️ Downloading...</span>
            </div>
          )}
        </div>
      </div>
      
      {progress.currentFile && (
        <div className="current-file">
          <strong>Current:</strong> {progress.currentFile}
        </div>
      )}
    </div>
  );
};

export default ProgressDisplay;