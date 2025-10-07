/**
 * IPCService Tests
 * Comprehensive test suite for the centralized IPC service
 */

import { IPCService, ipcService, useIPCService } from './IPCService';
import { DownloadConfig, UserSettings, IPC_CHANNELS } from '@/shared/types';

// Mock the LoggingService
jest.mock('./LoggingService', () => ({
  LoggingService: {
    getInstance: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock window.electronAPI
const mockElectronAPI = {
  // File operations
  openFileDialog: jest.fn(),
  openFolderDialog: jest.fn(),
  saveFileDialog: jest.fn(),

  // Excel operations
  loadExcelFile: jest.fn(),
  getSheetNames: jest.fn(),
  loadSheetData: jest.fn(),

  // Configuration
  saveConfig: jest.fn(),
  loadConfig: jest.fn(),

  // Settings
  saveSettings: jest.fn(),
  loadSettings: jest.fn(),

  // Updates
  checkForUpdates: jest.fn(),
  installUpdate: jest.fn(),
  downloadUpdate: jest.fn(),

  // Window operations
  minimizeWindow: jest.fn(),
  maximizeWindow: jest.fn(),
  closeWindow: jest.fn(),

  // Downloads
  startDownloads: jest.fn(),
  cancelDownloads: jest.fn(),

  // Event listeners
  onDownloadProgress: jest.fn(),
  onDownloadComplete: jest.fn(),
  onMenuOpenFile: jest.fn(),
  onMenuSaveConfig: jest.fn(),
  onMenuOpenSettings: jest.fn(),
  onUpdateChecking: jest.fn(),
  onUpdateAvailable: jest.fn(),
  onUpdateNotAvailable: jest.fn(),
  onUpdateError: jest.fn(),
  onUpdateDownloaded: jest.fn(),
  onUpdateDownloadProgress: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock window object
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('IPCService', () => {
  let service: IPCService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get fresh instance
    service = IPCService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = IPCService.getInstance();
      const instance2 = IPCService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return the same instance as exported singleton', () => {
      const instance = IPCService.getInstance();
      expect(instance).toBe(ipcService);
    });
  });

  describe('Electron Availability', () => {
    it('should detect when Electron API is available', () => {
      expect(service.isElectronAvailable()).toBe(true);
    });

    it('should detect when Electron API is not available', () => {
      delete (window as any).electronAPI;
      expect(service.isElectronAvailable()).toBe(false);

      // Restore for other tests
      (window as any).electronAPI = mockElectronAPI;
    });
  });

  describe('File Operations', () => {
    const mockFileResult = {
      canceled: false,
      filePaths: ['/path/to/file.xlsx'],
    };

    it('should handle openFileDialog successfully', async () => {
      mockElectronAPI.openFileDialog.mockResolvedValue(mockFileResult);

      const options = { title: 'Select File' };
      const result = await service.openFileDialog(options);

      expect(mockElectronAPI.openFileDialog).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockFileResult);
    });

    it('should handle openFolderDialog successfully', async () => {
      mockElectronAPI.openFolderDialog.mockResolvedValue(mockFileResult);

      const options = { title: 'Select Folder' };
      const result = await service.openFolderDialog(options);

      expect(mockElectronAPI.openFolderDialog).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockFileResult);
    });

    it('should handle saveFileDialog successfully', async () => {
      mockElectronAPI.saveFileDialog.mockResolvedValue(mockFileResult);

      const options = { title: 'Save File' };
      const result = await service.saveFileDialog(options);

      expect(mockElectronAPI.saveFileDialog).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockFileResult);
    });

    it('should handle file dialog errors', async () => {
      const error = new Error('File dialog failed');
      mockElectronAPI.openFileDialog.mockRejectedValue(error);

      await expect(service.openFileDialog()).rejects.toThrow(
        'File dialog failed'
      );
    });
  });

  describe('Excel Operations', () => {
    it('should handle loadExcelFile successfully', async () => {
      const mockData = { sheets: ['Sheet1'] };
      mockElectronAPI.loadExcelFile.mockResolvedValue(mockData);

      const result = await service.loadExcelFile('/path/to/file.xlsx');

      expect(mockElectronAPI.loadExcelFile).toHaveBeenCalledWith(
        '/path/to/file.xlsx'
      );
      expect(result).toEqual(mockData);
    });

    it('should handle getSheetNames successfully', async () => {
      const mockSheets = ['Sheet1', 'Sheet2'];
      mockElectronAPI.getSheetNames.mockResolvedValue(mockSheets);

      const result = await service.getSheetNames('/path/to/file.xlsx');

      expect(mockElectronAPI.getSheetNames).toHaveBeenCalledWith(
        '/path/to/file.xlsx'
      );
      expect(result).toEqual(mockSheets);
    });

    it('should handle loadSheetData successfully', async () => {
      const mockData = {
        columns: ['Part Number', 'Image URL'],
        rows: [
          {
            'Part Number': 'ABC123',
            'Image URL': 'http://example.com/image.jpg',
          },
        ],
        sheetName: 'Sheet1',
        filePath: '/path/to/file.xlsx',
      };
      mockElectronAPI.loadSheetData.mockResolvedValue(mockData);

      const result = await service.loadSheetData(
        '/path/to/file.xlsx',
        'Sheet1'
      );

      expect(mockElectronAPI.loadSheetData).toHaveBeenCalledWith(
        '/path/to/file.xlsx',
        'Sheet1'
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('Configuration Operations', () => {
    const mockConfig: DownloadConfig = {
      excelFile: '/path/to/file.xlsx',
      sheetName: 'Sheet1',
      partNoColumn: 'Part Number',
      imageColumns: ['Image URL'],
      pdfColumn: '',
      filenameColumn: '',
      imageFolder: '/downloads/images',
      pdfFolder: '/downloads/pdfs',
      sourceImageFolder: '',
      imageFilePath: '',
      pdfFilePath: '',
      maxWorkers: 5,
      backgroundProcessing: {
        enabled: true,
        method: 'smart_detect',
        quality: 95,
        edgeThreshold: 30,
      },
    };

    it('should handle saveConfig successfully', async () => {
      const mockResponse = { success: true };
      mockElectronAPI.saveConfig.mockResolvedValue(mockResponse);

      const result = await service.saveConfig(mockConfig);

      expect(mockElectronAPI.saveConfig).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual(mockResponse);
    });

    it('should handle loadConfig successfully', async () => {
      const mockAppConfig = {
        windowState: { width: 1200, height: 800, isMaximized: false },
        lastConfiguration: mockConfig,
        recentFiles: ['/path/to/file.xlsx'],
      };
      mockElectronAPI.loadConfig.mockResolvedValue(mockAppConfig);

      const result = await service.loadConfig();

      expect(mockElectronAPI.loadConfig).toHaveBeenCalled();
      expect(result).toEqual(mockAppConfig);
    });
  });

  describe('Settings Operations', () => {
    const mockSettings: UserSettings = {
      defaultPaths: {
        lastFileDialogPath: '',
        imageDownloadFolder: '/downloads/images',
        pdfDownloadFolder: '/downloads/pdfs',
        sourceImageFolder: '/source',
        imageNetworkPath: '//server/images',
        pdfNetworkPath: '//server/pdfs',
      },
      downloadBehavior: {
        defaultConcurrentDownloads: 5,
        connectionTimeout: 5,
        readTimeout: 30,
        retryAttempts: 3,
      },
      imageProcessing: {
        enabledByDefault: true,
        defaultMethod: 'smart_detect',
        defaultQuality: 95,
        defaultEdgeThreshold: 30,
      },
      uiPreferences: {
        rememberFileDialogPath: true,
        showAdvancedOptions: false,
        startupTab: 'file',
      },
      updateSettings: {
        enableAutoUpdates: true,
        checkForUpdatesOnStartup: true,
        downloadUpdatesAutomatically: false,
      },
    };

    it('should handle saveSettings successfully', async () => {
      const mockResponse = { success: true };
      mockElectronAPI.saveSettings.mockResolvedValue(mockResponse);

      const result = await service.saveSettings(mockSettings);

      expect(mockElectronAPI.saveSettings).toHaveBeenCalledWith(mockSettings);
      expect(result).toEqual(mockResponse);
    });

    it('should handle loadSettings successfully', async () => {
      mockElectronAPI.loadSettings.mockResolvedValue(mockSettings);

      const result = await service.loadSettings();

      expect(mockElectronAPI.loadSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('Download Operations', () => {
    const mockConfig: DownloadConfig = {
      excelFile: '/path/to/file.xlsx',
      sheetName: 'Sheet1',
      partNoColumn: 'Part Number',
      imageColumns: ['Image URL'],
      pdfColumn: '',
      filenameColumn: '',
      imageFolder: '/downloads/images',
      pdfFolder: '',
      sourceImageFolder: '',
      imageFilePath: '',
      pdfFilePath: '',
      maxWorkers: 5,
      backgroundProcessing: {
        enabled: false,
        method: 'smart_detect',
        quality: 95,
        edgeThreshold: 30,
      },
    };

    it('should handle startDownloads successfully', async () => {
      const mockResult = { success: true, message: 'Downloads started' };
      mockElectronAPI.startDownloads.mockResolvedValue(mockResult);

      const result = await service.startDownloads(mockConfig);

      expect(mockElectronAPI.startDownloads).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual(mockResult);
    });

    it('should handle cancelDownloads successfully', async () => {
      mockElectronAPI.cancelDownloads.mockResolvedValue(undefined);

      await service.cancelDownloads();

      expect(mockElectronAPI.cancelDownloads).toHaveBeenCalled();
    });
  });

  describe('Update Operations', () => {
    it('should handle checkForUpdates successfully', async () => {
      const mockResult = { available: false };
      mockElectronAPI.checkForUpdates.mockResolvedValue(mockResult);

      const result = await service.checkForUpdates();

      expect(mockElectronAPI.checkForUpdates).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should handle installUpdate successfully', async () => {
      mockElectronAPI.installUpdate.mockResolvedValue(undefined);

      await service.installUpdate();

      expect(mockElectronAPI.installUpdate).toHaveBeenCalled();
    });

    it('should handle downloadUpdate successfully', async () => {
      const mockResult = { success: true };
      mockElectronAPI.downloadUpdate.mockResolvedValue(mockResult);

      const result = await service.downloadUpdate();

      expect(mockElectronAPI.downloadUpdate).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('Window Operations', () => {
    it('should handle minimizeWindow successfully', async () => {
      mockElectronAPI.minimizeWindow.mockResolvedValue(undefined);

      await service.minimizeWindow();

      expect(mockElectronAPI.minimizeWindow).toHaveBeenCalled();
    });

    it('should handle maximizeWindow successfully', async () => {
      mockElectronAPI.maximizeWindow.mockResolvedValue(undefined);

      await service.maximizeWindow();

      expect(mockElectronAPI.maximizeWindow).toHaveBeenCalled();
    });

    it('should handle closeWindow successfully', async () => {
      mockElectronAPI.closeWindow.mockResolvedValue(undefined);

      await service.closeWindow();

      expect(mockElectronAPI.closeWindow).toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should register download progress callback', () => {
      const callback = jest.fn();

      service.onDownloadProgress(callback);

      expect(mockElectronAPI.onDownloadProgress).toHaveBeenCalled();
    });

    it('should register download complete callback', () => {
      const callback = jest.fn();

      service.onDownloadComplete(callback);

      expect(mockElectronAPI.onDownloadComplete).toHaveBeenCalled();
    });

    it('should register menu callbacks', () => {
      const callback = jest.fn();

      service.onMenuOpenFile(callback);
      service.onMenuSaveConfig(callback);
      service.onMenuOpenSettings(callback);

      expect(mockElectronAPI.onMenuOpenFile).toHaveBeenCalledWith(callback);
      expect(mockElectronAPI.onMenuSaveConfig).toHaveBeenCalledWith(callback);
      expect(mockElectronAPI.onMenuOpenSettings).toHaveBeenCalledWith(callback);
    });

    it('should register update callbacks', () => {
      const callback = jest.fn();

      service.onUpdateChecking(callback);
      service.onUpdateAvailable(callback);
      service.onUpdateNotAvailable(callback);
      service.onUpdateError(callback);
      service.onUpdateDownloaded(callback);
      service.onUpdateDownloadProgress(callback);

      expect(mockElectronAPI.onUpdateChecking).toHaveBeenCalledWith(callback);
      expect(mockElectronAPI.onUpdateAvailable).toHaveBeenCalledWith(callback);
      expect(mockElectronAPI.onUpdateNotAvailable).toHaveBeenCalledWith(
        callback
      );
      expect(mockElectronAPI.onUpdateError).toHaveBeenCalledWith(callback);
      expect(mockElectronAPI.onUpdateDownloaded).toHaveBeenCalledWith(callback);
      expect(mockElectronAPI.onUpdateDownloadProgress).toHaveBeenCalledWith(
        callback
      );
    });

    it('should handle missing optional callbacks gracefully', () => {
      delete (mockElectronAPI as any).onUpdateChecking;
      delete (mockElectronAPI as any).onUpdateError;

      const callback = jest.fn();

      // Should not throw
      expect(() => service.onUpdateChecking(callback)).not.toThrow();
      expect(() => service.onUpdateError(callback)).not.toThrow();

      // Restore for other tests
      mockElectronAPI.onUpdateChecking = jest.fn();
      mockElectronAPI.onUpdateError = jest.fn();
    });

    it('should handle event listeners when Electron API is not available', () => {
      delete (window as any).electronAPI;

      const callback = jest.fn();

      // Should not throw and should not attempt to register
      expect(() => service.onDownloadProgress(callback)).not.toThrow();
      expect(() => service.onMenuOpenFile(callback)).not.toThrow();

      // Restore for other tests
      (window as any).electronAPI = mockElectronAPI;
    });
  });

  describe('Utility Methods', () => {
    it('should remove all listeners for a channel', () => {
      service.removeAllListeners(IPC_CHANNELS.DOWNLOAD_PROGRESS);

      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith(
        IPC_CHANNELS.DOWNLOAD_PROGRESS
      );
    });

    it('should remove listeners for multiple channels', () => {
      const channels = [
        IPC_CHANNELS.DOWNLOAD_PROGRESS,
        IPC_CHANNELS.DOWNLOAD_COMPLETE,
      ];

      service.removeMultipleListeners(channels);

      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledTimes(2);
      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith(
        IPC_CHANNELS.DOWNLOAD_PROGRESS
      );
      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith(
        IPC_CHANNELS.DOWNLOAD_COMPLETE
      );
    });

    it('should cleanup specific channels', () => {
      const channels = [
        IPC_CHANNELS.DOWNLOAD_PROGRESS,
        IPC_CHANNELS.UPDATE_AVAILABLE,
      ];

      service.cleanup(channels);

      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledTimes(2);
      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith(
        IPC_CHANNELS.DOWNLOAD_PROGRESS
      );
      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith(
        IPC_CHANNELS.UPDATE_AVAILABLE
      );
    });

    it('should cleanup common channels when none specified', () => {
      service.cleanup();

      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledTimes(6);
    });

    it('should handle cleanup errors gracefully', () => {
      mockElectronAPI.removeAllListeners.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      expect(() =>
        service.cleanup([IPC_CHANNELS.DOWNLOAD_PROGRESS])
      ).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when Electron API is not available', async () => {
      delete (window as any).electronAPI;

      await expect(service.loadSettings()).rejects.toThrow(
        'Electron API not available'
      );

      // Restore for other tests
      (window as any).electronAPI = mockElectronAPI;
    });

    it('should propagate IPC errors', async () => {
      const error = new Error('IPC operation failed');
      mockElectronAPI.loadSettings.mockRejectedValue(error);

      await expect(service.loadSettings()).rejects.toThrow(
        'IPC operation failed'
      );
    });

    it('should handle callback errors in event listeners', () => {
      const callback = jest.fn(() => {
        throw new Error('Callback failed');
      });

      service.onDownloadProgress(callback);

      // Get the wrapped callback that was passed to mockElectronAPI.onDownloadProgress
      const wrappedCallback =
        mockElectronAPI.onDownloadProgress.mock.calls[0][0];

      // Should not throw when wrapped callback encounters an error
      expect(() => wrappedCallback({ percentage: 50 })).not.toThrow();
    });
  });

  describe('React Hook Integration', () => {
    // Note: Testing React hooks requires @testing-library/react-hooks
    // For now, we'll test that the hook returns the expected methods

    it('should provide all IPC methods through hook', () => {
      const hookMethods = useIPCService();

      // Check that all expected methods are present
      expect(typeof hookMethods.openFileDialog).toBe('function');
      expect(typeof hookMethods.loadSettings).toBe('function');
      expect(typeof hookMethods.saveConfig).toBe('function');
      expect(typeof hookMethods.startDownloads).toBe('function');
      expect(typeof hookMethods.onDownloadProgress).toBe('function');
      expect(typeof hookMethods.cleanup).toBe('function');
    });
  });
});

describe('Integration Tests', () => {
  it('should maintain singleton behavior across different access patterns', () => {
    const service1 = IPCService.getInstance();
    const service2 = ipcService;
    const hookMethods = useIPCService();

    // All should reference the same instance
    expect(service1).toBe(service2);

    // Hook methods should be bound to the same instance
    // (This is harder to test directly, but the binding ensures consistency)
    expect(typeof hookMethods.loadSettings).toBe('function');
  });

  it('should handle complex error scenarios', async () => {
    // Simulate network timeout
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'TimeoutError';
    mockElectronAPI.checkForUpdates.mockRejectedValue(timeoutError);

    await expect(ipcService.checkForUpdates()).rejects.toThrow(
      'Request timeout'
    );
  });

  it('should work with partial electronAPI implementations', () => {
    // Simulate missing optional methods
    const partialAPI = { ...mockElectronAPI };
    delete (partialAPI as any).onUpdateChecking;
    delete (partialAPI as any).onUpdateError;

    (window as any).electronAPI = partialAPI;

    const callback = jest.fn();

    // Should handle gracefully
    expect(() => ipcService.onUpdateChecking(callback)).not.toThrow();
    expect(() => ipcService.onUpdateError(callback)).not.toThrow();

    // Restore
    (window as any).electronAPI = mockElectronAPI;
  });
});
