import { useEffect } from 'react';

type EventListenerConfig = {
  channel: string;
  handler: () => void;
  dependencies?: React.DependencyList;
};

export const useEventListeners = (listeners: EventListenerConfig[]) => {
  useEffect(
    () => {
      // Register all listeners
      listeners.forEach(({ channel, handler }) => {
        switch (channel) {
          case 'menu-open-file':
            window.electronAPI.onMenuOpenFile(handler);
            break;
          case 'menu-save-config':
            window.electronAPI.onMenuSaveConfig(handler);
            break;
          case 'menu-open-settings':
            window.electronAPI.onMenuOpenSettings(handler);
            break;
          case 'update-available':
            window.electronAPI.onUpdateAvailable(handler);
            break;
          case 'update-not-available':
            window.electronAPI.onUpdateNotAvailable(handler);
            break;
          default:
            console.warn(`Unknown event channel: ${channel}`);
        }
      });

      return () => {
        // Cleanup all listeners
        listeners.forEach(({ channel }) => {
          window.electronAPI.removeAllListeners(channel as any);
        });
      };
    },
    listeners.flatMap(l => l.dependencies || [])
  );
};
