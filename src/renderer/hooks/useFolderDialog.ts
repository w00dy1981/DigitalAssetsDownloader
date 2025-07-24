import { useCallback } from 'react';

interface FolderDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: string[];
}

export const useFolderDialog = () => {
  const openFolderDialog = useCallback(async (
    onSelect: (path: string) => void,
    options: FolderDialogOptions = {},
    onError?: (error: string) => void
  ) => {
    try {
      const result = await window.electronAPI.openFolderDialog({
        title: options.title || 'Select Folder',
        defaultPath: options.defaultPath,
        properties: options.properties || ['openDirectory'],
      });
      
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        onSelect(result.filePaths[0]);
      }
    } catch (error) {
      const errorMessage = 'Failed to open folder dialog.';
      console.error('Folder dialog error:', error);
      if (onError) {
        onError(errorMessage);
      }
    }
  }, []);

  return { openFolderDialog };
};