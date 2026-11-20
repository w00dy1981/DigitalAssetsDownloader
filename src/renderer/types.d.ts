import type { ElectronAPI } from '@/main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  interface File {
    path?: string;
  }
}
