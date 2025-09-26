import { useEffect } from 'react';
import { ipcService } from '@/services/IPCService';
import { logger } from '@/services/LoggingService';

type EventListenerConfig = {
  channel: string;
  handler: (...args: unknown[]) => void;
  dependencies?: React.DependencyList;
};

export const useEventListeners = (listeners: EventListenerConfig[]) => {
  useEffect(() => {
    // Register all listeners
    listeners.forEach(({ channel, handler }) => {
      switch (channel) {
        case 'menu-open-file':
          ipcService.onMenuOpenFile(handler);
          break;
        case 'menu-save-config':
          ipcService.onMenuSaveConfig(handler);
          break;
        case 'menu-open-settings':
          ipcService.onMenuOpenSettings(handler);
          break;
        case 'update-available':
          ipcService.onUpdateAvailable(handler as () => void);
          break;
        case 'update-not-available':
          ipcService.onUpdateNotAvailable(handler as () => void);
          break;
        default:
          logger.warn(
            `useEventListeners: Unknown event channel ${channel}`,
            'useEventListeners'
          );
      }
    });

    return () => {
      // Cleanup all listeners
      listeners.forEach(({ channel }) => {
        ipcService.removeAllListeners(channel);
      });
    };
  }, [listeners]);
};
