import React from 'react';
import type { UserSettings } from '@/shared/userSettings';
import { FolderSelector } from '@/renderer/components/ui/FolderSelector';

interface DefaultPathsSectionProps {
  settings: UserSettings['defaultPaths'];
  onSettingUpdate: (changes: Partial<UserSettings['defaultPaths']>) => void;
}

export const DefaultPathsSection: React.FC<DefaultPathsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  return (
    <div className="config-section default-paths">
      <h3>Default Paths</h3>

      <div className="form-group">
        <label htmlFor="image-download-folder">Image Download Folder</label>
        <FolderSelector
          id="image-download-folder"
          value={settings.imageDownloadFolder}
          onChange={path => onSettingUpdate({ imageDownloadFolder: path })}
          placeholder="Choose folder for downloading images..."
          dialogTitle="Select Image Download Folder"
        />
      </div>

      <div className="form-group">
        <label htmlFor="pdf-download-folder">PDF Download Folder</label>
        <FolderSelector
          id="pdf-download-folder"
          value={settings.pdfDownloadFolder}
          onChange={path => onSettingUpdate({ pdfDownloadFolder: path })}
          placeholder="Choose folder for downloading PDFs..."
          dialogTitle="Select PDF Download Folder"
        />
      </div>

      <div className="form-group">
        <label htmlFor="source-image-folder">Source Image Folder</label>
        <FolderSelector
          id="source-image-folder"
          value={settings.sourceImageFolder}
          onChange={path => onSettingUpdate({ sourceImageFolder: path })}
          placeholder="Choose folder to search for existing images..."
          dialogTitle="Select Source Image Folder"
        />
        <small className="text-muted">
          Optional: Folder to search for existing images by part number
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="image-network-path">Image Network Path</label>
        <FolderSelector
          id="image-network-path"
          value={settings.imageNetworkPath}
          onChange={path => onSettingUpdate({ imageNetworkPath: path })}
          placeholder="\\server\share\images"
          dialogTitle="Select Image Network Path"
        />
        <small className="text-muted">
          Optional. The Excel workbook uses this path to reference images for
          ABM.
        </small>
      </div>
    </div>
  );
};
