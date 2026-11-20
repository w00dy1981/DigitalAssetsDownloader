import React from 'react';
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
  const handleBrowse = async () => {
    try {
      const { canceled, filePaths } = await window.electronAPI.openFolderDialog(
        {
          title: dialogTitle || 'Select Folder',
          defaultPath: editable && dialogTitle ? undefined : value,
        }
      );
      if (!canceled && filePaths[0]) onChange(filePaths[0]);
    } catch (error) {
      const message =
        editable && dialogTitle && error instanceof Error
          ? error.message
          : 'Failed to open folder dialog.';
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
        className={editable ? 'btn btn-primary' : buttonClassName}
      >
        {buttonText}
      </button>
    </div>
  );
};
