import React from 'react';
import { useFolderDialog } from '../../hooks/useFolderDialog';

interface FolderSelectorProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onError?: (error: string) => void;
  buttonText?: string;
  buttonClassName?: string;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select folder...',
  disabled = false,
  onError,
  buttonText = 'Browse',
  buttonClassName = 'btn btn-outline-secondary',
}) => {
  const { openFolderDialog } = useFolderDialog();

  const handleBrowse = () => {
    openFolderDialog(
      onChange,
      {
        title: 'Select Folder',
        defaultPath: value,
      },
      onError
    );
  };

  return (
    <div className="folder-selector">
      <input
        type="text"
        value={value}
        readOnly
        placeholder={placeholder}
        className="form-control"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleBrowse}
        disabled={disabled}
        className={buttonClassName}
      >
        {buttonText}
      </button>
    </div>
  );
};
