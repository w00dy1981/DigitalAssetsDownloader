// Add custom jest matchers from jest-dom
require('@testing-library/jest-dom');

// Mock electron for tests
global.window = global.window || {};
global.window.electronAPI = {
  selectFolder: jest.fn(),
  selectFile: jest.fn(),
  showErrorDialog: jest.fn(),
  openExternal: jest.fn(),
  saveSettings: jest.fn(),
  loadSettings: jest.fn(),
  saveConfig: jest.fn(),
  checkForUpdates: jest.fn(),
  onUpdateAvailable: jest.fn(),
  onDownloadProgress: jest.fn(),
  onUpdateDownloaded: jest.fn(),
  onUpdateError: jest.fn(),
  installUpdate: jest.fn(),
  startDownloads: jest.fn(),
  cancelDownloads: jest.fn(),
  onDownloadProgress: jest.fn(),
  onDownloadComplete: jest.fn(),
  onDownloadError: jest.fn(),
  onDownloadFinished: jest.fn(),
};