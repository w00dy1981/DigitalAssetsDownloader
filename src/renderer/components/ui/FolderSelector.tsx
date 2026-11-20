import React from 'react';

interface FolderSelectorProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  onError?: (error: string) => void;
  id: string;
  dialogTitle?: string;
  editable?: boolean;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select folder...',
  onError,
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
        console.error(
          'FolderSelector: Error opening folder dialog',
          error instanceof Error ? error : new Error(message)
        );
      }
    }
  };

  return (
    <div className={editable ? 'folder-input-group' : 'folder-selector'}>
      <input
        id={id}
        type="text"
        value={value}
        readOnly={!editable}
        onChange={editable ? e => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        className="form-control"
      />
      <button
        type="button"
        onClick={handleBrowse}
        className={editable ? 'btn btn-primary' : 'btn btn-outline-secondary'}
      >
        Browse
      </button>
    </div>
  );
};
