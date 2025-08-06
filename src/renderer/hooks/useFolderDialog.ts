import { useCallback } from 'react';
import { ipcService } from '@/services/IPCService';

interface FolderDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: string[];
}

/**
 * Legacy useFolderDialog hook - now powered by IPCService
 * Maintained for backward compatibility with existing components
 *
 * New components can use ipcService.openFolderDialog() directly for more control
 */
export const useFolderDialog = () => {
  const openFolderDialog = useCallback(
    async (
      onSelect: (path: string) => void,
      options: FolderDialogOptions = {},
      onError?: (error: string) => void
    ) => {
      try {
        const result = await ipcService.openFolderDialog({
          title: options.title || 'Select Folder',
          defaultPath: options.defaultPath,
          properties: options.properties || ['openDirectory'],
        });

        if (
          !result.canceled &&
          result.filePaths &&
          result.filePaths.length > 0
        ) {
          onSelect(result.filePaths[0]);
        }
      } catch (error) {
        const errorMessage = 'Failed to open folder dialog.';
        console.error('Folder dialog error:', error);
        if (onError) {
          onError(errorMessage);
        }
      }
    },
    []
  );

  return { openFolderDialog };
};
