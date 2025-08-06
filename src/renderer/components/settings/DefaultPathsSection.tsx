import React from 'react';
import { UserSettings } from '@/shared/types';
import { FolderSelector } from '@/renderer/components/ui';

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
        <div className="folder-input-group">
          <input
            id="image-download-folder"
            type="text"
            value={settings.defaultPaths.imageDownloadFolder}
            onChange={(e) => handlePathChange('imageDownloadFolder', e.target.value)}
            className="form-control"
            placeholder="Choose folder for downloading images..."
          />
          <button
            className="btn btn-secondary browse-btn"
            onClick={() => {
              // Using legacy folder dialog approach to maintain compatibility
              window.electronAPI.openFolderDialog({
                title: 'Select Image Download Folder',
                properties: ['openDirectory'],
              }).then((result) => {
                if (result.filePaths && result.filePaths.length > 0) {
                  handlePathChange('imageDownloadFolder', result.filePaths[0]);
                }
              }).catch(console.error);
            }}
          >
            Browse
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="pdf-download-folder">PDF Download Folder</label>
        <div className="folder-input-group">
          <input
            id="pdf-download-folder"
            type="text"
            value={settings.defaultPaths.pdfDownloadFolder}
            onChange={(e) => handlePathChange('pdfDownloadFolder', e.target.value)}
            className="form-control"
            placeholder="Choose folder for downloading PDFs..."
          />
          <button
            className="btn btn-secondary browse-btn"
            onClick={() => {
              window.electronAPI.openFolderDialog({
                title: 'Select PDF Download Folder',
                properties: ['openDirectory'],
              }).then((result) => {
                if (result.filePaths && result.filePaths.length > 0) {
                  handlePathChange('pdfDownloadFolder', result.filePaths[0]);
                }
              }).catch(console.error);
            }}
          >
            Browse
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="source-image-folder">Source Image Folder</label>
        <div className="folder-input-group">
          <input
            id="source-image-folder"
            type="text"
            value={settings.defaultPaths.sourceImageFolder}
            onChange={(e) => handlePathChange('sourceImageFolder', e.target.value)}
            className="form-control"
            placeholder="Choose folder to search for existing images..."
          />
          <button
            className="btn btn-secondary browse-btn"
            onClick={() => {
              window.electronAPI.openFolderDialog({
                title: 'Select Source Image Folder',
                properties: ['openDirectory'],
              }).then((result) => {
                if (result.filePaths && result.filePaths.length > 0) {
                  handlePathChange('sourceImageFolder', result.filePaths[0]);
                }
              }).catch(console.error);
            }}
          >
            Browse
          </button>
        </div>
        <small className="text-muted">
          Optional: Folder to search for existing images by part number
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="image-network-path">Image Network Path (for CSV logging)</label>
        <div className="folder-input-group">
          <input
            id="image-network-path"
            type="text"
            value={settings.defaultPaths.imageNetworkPath}
            onChange={(e) => handlePathChange('imageNetworkPath', e.target.value)}
            className="form-control"
            placeholder="Network path for image file logging..."
          />
          <button
            className="btn btn-secondary browse-btn"
            onClick={() => {
              window.electronAPI.openFolderDialog({
                title: 'Select Image Network Path',
                properties: ['openDirectory'],
              }).then((result) => {
                if (result.filePaths && result.filePaths.length > 0) {
                  handlePathChange('imageNetworkPath', result.filePaths[0]);
                }
              }).catch(console.error);
            }}
          >
            Browse
          </button>
        </div>
        <small className="text-muted">
          Network path used for CSV logging (separate from download location)
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="pdf-network-path">PDF Network Path (for CSV logging)</label>
        <div className="folder-input-group">
          <input
            id="pdf-network-path"
            type="text"
            value={settings.defaultPaths.pdfNetworkPath}
            onChange={(e) => handlePathChange('pdfNetworkPath', e.target.value)}
            className="form-control"
            placeholder="Network path for PDF file logging..."
          />
          <button
            className="btn btn-secondary browse-btn"
            onClick={() => {
              window.electronAPI.openFolderDialog({
                title: 'Select PDF Network Path',
                properties: ['openDirectory'],
              }).then((result) => {
                if (result.filePaths && result.filePaths.length > 0) {
                  handlePathChange('pdfNetworkPath', result.filePaths[0]);
                }
              }).catch(console.error);
            }}
          >
            Browse
          </button>
        </div>
        <small className="text-muted">
          Network path used for PDF CSV logging (separate from download location)
        </small>
      </div>
    </div>
  );
};