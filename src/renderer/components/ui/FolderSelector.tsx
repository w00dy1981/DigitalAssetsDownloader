import React from 'react';
import { useFolderDialog } from '../../hooks/useFolderDialog';
import { ipcService } from '@/services/IPCService';
import { logger } from '@/services/LoggingService';

interface FolderSelectorProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onError?: (error: string) => void;
  buttonText?: string;
  buttonClassName?: string;
  // New props for enhanced functionality
  id?: string;
  dialogTitle?: string;
  editable?: boolean;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select folder...',
  disabled = false,
  onError,
  buttonText = 'Browse',
  buttonClassName = 'btn btn-outline-secondary',
  id,
  dialogTitle,
  editable = false,
}) => {
  const { openFolderDialog } = useFolderDialog();

  const handleBrowse = async () => {
    // For enhanced mode, use direct electronAPI call to match existing behavior
    if (editable && dialogTitle) {
      try {
        const result = await ipcService.openFolderDialog({
          title: dialogTitle,
          properties: ['openDirectory'],
        });

        if (
          !result.canceled &&
          result.filePaths &&
          result.filePaths.length > 0
        ) {
          onChange(result.filePaths[0]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (onError) {
          onError(message);
        } else {
          logger.error(
            'FolderSelector: Error opening folder dialog',
            error instanceof Error ? error : new Error(message),
            'FolderSelector'
          );
        }
      }
    } else {
      // Use existing hook for backward compatibility
      openFolderDialog(
        onChange,
        {
          title: dialogTitle || 'Select Folder',
          defaultPath: value,
        },
        onError
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editable) {
      onChange(e.target.value);
    }
  };

  return (
    <div className={editable ? 'folder-input-group' : 'folder-selector'}>
      <input
        id={id}
        type="text"
        value={value}
        readOnly={!editable}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="form-control"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleBrowse}
        disabled={disabled}
        className={editable ? 'btn btn-secondary browse-btn' : buttonClassName}
      >
        {buttonText}
      </button>
    </div>
  );
};
