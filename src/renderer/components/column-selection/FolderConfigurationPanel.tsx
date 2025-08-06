import React, { useCallback } from 'react';
import { FolderSelector } from '@/renderer/components/ui';
import { ValidationService } from '@/services/ValidationService';

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
  onError
}) => {
  // Validate folder path for download folders
  const validateFolderPath = useCallback((path: string, isRequired: boolean = true): boolean => {
    if (!path || path.trim() === '') {
      if (isRequired) {
        onError('Folder path is required');
        return false;
      }
      return true; // Allow empty paths for optional folders
    }
    
    const pathResult = ValidationService.validateFolderPath(path, 'Folder Path', { required: isRequired });
    if (!pathResult.isValid) {
      onError(pathResult.errors[0]);
      return false;
    }
    
    return true;
  }, [onError]);

  const handleImageFolderChange = useCallback((value: string) => {
    if (!validateFolderPath(value, true)) {
      return; // Validation failed, don't update
    }
    onImageFolderChange(value);
  }, [onImageFolderChange, validateFolderPath]);

  const handlePdfFolderChange = useCallback((value: string) => {
    if (!validateFolderPath(value, true)) {
      return; // Validation failed, don't update
    }
    onPdfFolderChange(value);
  }, [onPdfFolderChange, validateFolderPath]);

  const handleSourceImageFolderChange = useCallback((value: string) => {
    if (!validateFolderPath(value, false)) { // Source folder is optional
      return; // Validation failed, don't update
    }
    onSourceImageFolderChange(value);
  }, [onSourceImageFolderChange, validateFolderPath]);
  return (
    <div className="config-section">
      <h3>Download Folders</h3>
      
      {/* Image Download Folder */}
      <div className="form-group">
        <label htmlFor="image-folder">Image Download Folder *</label>
        <FolderSelector
          value={imageFolder}
          onChange={handleImageFolderChange}
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
          value={pdfFolder}
          onChange={handlePdfFolderChange}
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
          value={sourceImageFolder}
          onChange={handleSourceImageFolderChange}
          placeholder="Folder to search for existing images"
          onError={onError}
        />
        <small className="text-muted">
          If specified, the system will search this folder for images matching part numbers before downloading
        </small>
      </div>
    </div>
  );
};

export default FolderConfigurationPanel;