import React from 'react';
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
  function changePath(value: string, onChange: (value: string) => void) {
    const path = value.trim();
    if (path.includes('\\0') || path.length > 260) {
      onError('Invalid network path format');
      return;
    }
    if (path && !path.startsWith('\\\\')) {
      onError(
        'Network paths should use UNC format (\\\\server\\share) for network accessibility'
      );
      return;
    }
    onChange(value);
  }

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
          id="image-network-path"
          value={imageFilePath}
          onChange={value => changePath(value, onImageFilePathChange)}
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
          id="pdf-network-path"
          value={pdfFilePath}
          onChange={value => changePath(value, onPdfFilePathChange)}
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
