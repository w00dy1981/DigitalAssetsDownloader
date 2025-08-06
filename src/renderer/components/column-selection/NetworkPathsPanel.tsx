import React, { useCallback } from 'react';
import { FolderSelector } from '@/renderer/components/ui';

interface NetworkPathsPanelProps {
  imageFilePath: string;
  onImageFilePathChange: (value: string) => void;
  pdfFilePath: string;
  onPdfFilePathChange: (value: string) => void;
  onError: (error: string) => void;
}

const NetworkPathsPanel: React.FC<NetworkPathsPanelProps> = ({
  imageFilePath,
  onImageFilePathChange,
  pdfFilePath,
  onPdfFilePathChange,
  onError,
}) => {
  // Simple browser-safe network path validation
  const validateNetworkPath = useCallback(
    (path: string): boolean => {
      if (!path || path.trim() === '') return true; // Allow empty paths

      // Basic browser-safe validation
      const trimmedPath = path.trim();
      if (trimmedPath.includes('\0') || trimmedPath.length > 260) {
        onError('Invalid network path format');
        return false;
      }

      // UNC path validation (Windows network paths)
      if (trimmedPath.length > 0 && !trimmedPath.startsWith('\\\\')) {
        onError(
          'Network paths should use UNC format (\\\\server\\share) for network accessibility'
        );
        return false;
      }

      return true;
    },
    [onError]
  );

  const handleImagePathChange = useCallback(
    (value: string) => {
      if (!validateNetworkPath(value)) {
        return; // Validation failed, don't update
      }
      onImageFilePathChange(value);
    },
    [onImageFilePathChange, validateNetworkPath]
  );

  const handlePdfPathChange = useCallback(
    (value: string) => {
      if (!validateNetworkPath(value)) {
        return; // Validation failed, don't update
      }
      onPdfFilePathChange(value);
    },
    [onPdfFilePathChange, validateNetworkPath]
  );

  return (
    <div className="config-section">
      <h3>Network Paths Configuration</h3>
      <p className="text-muted mb-3">
        Configure network paths for CSV logging. These paths will be recorded in
        download reports but are separate from your local download folders
        above.
      </p>

      {/* Image Network Path */}
      <div className="form-group">
        <label htmlFor="image-network-path">
          Image Network Path (for CSV logging)
        </label>
        <FolderSelector
          value={imageFilePath}
          onChange={handleImagePathChange}
          placeholder="Network path for image files in CSV log (e.g., \\\\server\\images\\)"
          onError={onError}
        />
        <small className="text-muted">
          Network path that will be logged in CSV reports for downloaded images.
          Use UNC format (\\\\server\\share) for network accessibility.
        </small>
      </div>

      {/* PDF Network Path */}
      <div className="form-group">
        <label htmlFor="pdf-network-path">
          PDF Network Path (for CSV logging)
        </label>
        <FolderSelector
          value={pdfFilePath}
          onChange={handlePdfPathChange}
          placeholder="Network path for PDF files in CSV log (e.g., \\\\server\\pdfs\\)"
          onError={onError}
        />
        <small className="text-muted">
          Network path that will be logged in CSV reports for downloaded PDFs.
          Use UNC format (\\\\server\\share) for network accessibility.
        </small>
      </div>

      <div className="alert alert-info">
        <strong>Note:</strong> Network paths are used for generating CSV reports
        that reference files on shared network locations. These are different
        from your local download folders and should point to network-accessible
        locations where other users can access the downloaded files.
      </div>
    </div>
  );
};

export default NetworkPathsPanel;
