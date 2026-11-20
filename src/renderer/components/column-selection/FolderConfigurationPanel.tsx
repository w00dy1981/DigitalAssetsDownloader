import { FolderSelector } from '@/renderer/components/ui';

import type { MappingFields } from './useColumnSelectionState';

const FolderConfigurationPanel = ({
  config,
  update,
  onError,
}: MappingFields & { onError: (message: string) => void }) => {
  return (
    <div className="config-section">
      <h3>Download Folders</h3>

      {/* Image Download Folder */}
      <div className="form-group">
        <label htmlFor="image-folder">Image Download Folder *</label>
        <FolderSelector
          id="image-folder"
          value={config.imageFolder}
          onChange={value => update('imageFolder', value)}
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
          value={config.pdfFolder}
          onChange={value => update('pdfFolder', value)}
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
          value={config.sourceImageFolder}
          onChange={value => update('sourceImageFolder', value)}
          placeholder="Folder to search for existing images"
          onError={onError}
        />
        <small className="text-muted">
          If specified, the system will search this folder for images matching
          part numbers before downloading
        </small>
      </div>
      <div className="form-group">
        <label htmlFor="mapping-image-network-path">Image Network Path</label>
        <FolderSelector
          id="mapping-image-network-path"
          value={config.imageFilePath}
          onChange={value => {
            update('imageFilePath', value);
            void window.electronAPI
              .saveImageNetworkPath(value)
              .catch(error => onError(String(error)));
          }}
          placeholder="Shared folder for workbook photo references"
          onError={onError}
        />
      </div>
    </div>
  );
};

export default FolderConfigurationPanel;
