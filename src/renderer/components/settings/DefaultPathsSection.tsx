import React from 'react';
import { UserSettings } from '@/shared/types';
import { FolderSelector } from '@/renderer/components/ui/FolderSelector';

interface DefaultPathsSectionProps {
  settings: UserSettings;
  onSettingUpdate: (path: string, value: any) => void;
}

export const DefaultPathsSection: React.FC<DefaultPathsSectionProps> = ({
  settings,
  onSettingUpdate,
}) => {
  const handlePathChange = (settingKey: string, value: string) => {
    onSettingUpdate(`defaultPaths.${settingKey}`, value);
  };

  return (
    <div className="config-section default-paths">
      <h3>Default Paths</h3>

      <div className="form-group">
        <label htmlFor="image-download-folder">Image Download Folder</label>
        <FolderSelector
          id="image-download-folder"
          value={settings.defaultPaths.imageDownloadFolder}
          onChange={path => handlePathChange('imageDownloadFolder', path)}
          placeholder="Choose folder for downloading images..."
          dialogTitle="Select Image Download Folder"
          editable={true}
        />
      </div>

      <div className="form-group">
        <label htmlFor="pdf-download-folder">PDF Download Folder</label>
        <FolderSelector
          id="pdf-download-folder"
          value={settings.defaultPaths.pdfDownloadFolder}
          onChange={path => handlePathChange('pdfDownloadFolder', path)}
          placeholder="Choose folder for downloading PDFs..."
          dialogTitle="Select PDF Download Folder"
          editable={true}
        />
      </div>

      <div className="form-group">
        <label htmlFor="source-image-folder">Source Image Folder</label>
        <FolderSelector
          id="source-image-folder"
          value={settings.defaultPaths.sourceImageFolder}
          onChange={path => handlePathChange('sourceImageFolder', path)}
          placeholder="Choose folder to search for existing images..."
          dialogTitle="Select Source Image Folder"
          editable={true}
        />
        <small className="text-muted">
          Optional: Folder to search for existing images by part number
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="image-network-path">
          Image Network Path (for CSV logging)
        </label>
        <FolderSelector
          id="image-network-path"
          value={settings.defaultPaths.imageNetworkPath}
          onChange={path => handlePathChange('imageNetworkPath', path)}
          placeholder="Network path for image file logging..."
          dialogTitle="Select Image Network Path"
          editable={true}
        />
        <small className="text-muted">
          Network path used for CSV logging (separate from download location)
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="pdf-network-path">
          PDF Network Path (for CSV logging)
        </label>
        <FolderSelector
          id="pdf-network-path"
          value={settings.defaultPaths.pdfNetworkPath}
          onChange={path => handlePathChange('pdfNetworkPath', path)}
          placeholder="Network path for PDF file logging..."
          dialogTitle="Select PDF Network Path"
          editable={true}
        />
        <small className="text-muted">
          Network path used for PDF CSV logging (separate from download
          location)
        </small>
      </div>
    </div>
  );
};
