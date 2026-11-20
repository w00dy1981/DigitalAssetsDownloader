import React from 'react';

interface FolderSelectorProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  onError?: (error: string) => void;
  id: string;
  dialogTitle?: string;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select folder...',
  onError,
  id,
  dialogTitle,
}) => {
  const handleBrowse = async () => {
    try {
      const { canceled, filePaths } = await window.electronAPI.openFolderDialog(
        {
          title: dialogTitle || 'Select Folder',
          defaultPath: value,
        }
      );
      if (!canceled && filePaths[0]) onChange(filePaths[0]);
    } catch (error) {
      const message =
        error instanceof Error
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
    <div className="folder-input-group">
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-control"
      />
      <button type="button" onClick={handleBrowse} className="btn btn-primary">
        Browse
      </button>
    </div>
  );
};
