import React, { useEffect, useRef } from 'react';
import { logger } from '@/services/LoggingService';

interface ActivityLogProps {
  logs: string[];
}

const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logsEndRef.current && logs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Log activity to LoggingService when logs change
  useEffect(() => {
    if (logs.length > 0) {
      const latestLog = logs[logs.length - 1];
      
      // Parse log content and determine appropriate log level
      if (latestLog.toLowerCase().includes('error')) {
        logger.error('ActivityLog: Download error detected', new Error(latestLog), 'ActivityLog');
      } else if (latestLog.toLowerCase().includes('warning')) {
        logger.warn('ActivityLog: Download warning detected', 'ActivityLog', { message: latestLog });
      } else if (latestLog.toLowerCase().includes('complete')) {
        logger.info('ActivityLog: Download operation completed', 'ActivityLog', { message: latestLog });
      } else if (latestLog.toLowerCase().includes('starting') || latestLog.toLowerCase().includes('cancelling')) {
        logger.info('ActivityLog: Download state change', 'ActivityLog', { message: latestLog });
      } else {
        logger.debug('ActivityLog: General activity', 'ActivityLog', { message: latestLog });
      }
    }
  }, [logs]);

  // Only render if there are logs to show
  if (logs.length === 0) {
    return null;
  }

  logger.debug('ActivityLog: Rendering activity log', 'ActivityLog', { logCount: logs.length });

  return (
    <div className="logs-section">
      <h3>Activity Log</h3>
      <div className="logs-container">
        {logs.map((log, index) => (
          <div key={index} className="log-entry">
            {log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default ActivityLog;