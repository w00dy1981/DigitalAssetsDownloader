import React from 'react';
import { FolderSelector } from '@/renderer/components/ui';

interface FolderConfigurationPanelProps {
  imageFolder: string;
  onImageFolderChange: (value: string) => void;
  pdfFolder: string;
  onPdfFolderChange: (value: string) => void;
  sourceImageFolder: string;
  onSourceImageFolderChange: (value: string) => void;
  onError: (error: string) => void;
}

const FolderConfigurationPanel: React.FC<FolderConfigurationPanelProps> = ({
  imageFolder,
  onImageFolderChange,
  pdfFolder,
  onPdfFolderChange,
  sourceImageFolder,
  onSourceImageFolderChange,
  onError,
}) => {
  function changeFolder(
    value: string,
    onChange: (value: string) => void,
    required = true
  ) {
    if (!value.trim()) {
      if (required) onError('Folder path is required');
      else onChange(value);
      return;
    }

    if (value.includes('\\0') || value.length > 260) {
      onError('Invalid folder path format');
      return;
    }
    onChange(value);
  }

  return (
    <div className="config-section">
      <h3>Download Folders</h3>

      {/* Image Download Folder */}
      <div className="form-group">
        <label htmlFor="image-folder">Image Download Folder *</label>
        <FolderSelector
          id="image-folder"
          value={imageFolder}
          onChange={value => changeFolder(value, onImageFolderChange)}
          placeholder="Select folder for downloaded images"
          onError={onError}
        />
        <small className="text-muted">
          Local folder where downloaded images will be saved
        </small>
      </div>

      {/* PDF Download Folder */}
      <div className="form-group">
        <label htmlFor="pdf-folder">PDF Download Folder *</label>
        <FolderSelector
          id="pdf-folder"
          value={pdfFolder}
          onChange={value => changeFolder(value, onPdfFolderChange)}
          placeholder="Select folder for downloaded PDFs"
          onError={onError}
        />
        <small className="text-muted">
          Local folder where downloaded PDFs will be saved
        </small>
      </div>

      {/* Source Image Folder */}
      <div className="form-group">
        <label htmlFor="source-folder">Source Image Folder (Optional)</label>
        <FolderSelector
          id="source-folder"
          value={sourceImageFolder}
          onChange={value =>
            changeFolder(value, onSourceImageFolderChange, false)
          }
          placeholder="Folder to search for existing images"
          onError={onError}
        />
        <small className="text-muted">
          If specified, the system will search this folder for images matching
          part numbers before downloading
        </small>
      </div>
    </div>
  );
};

export default FolderConfigurationPanel;
