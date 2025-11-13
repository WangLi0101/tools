import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveAs: (
        sourcePath: string,
        options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }
      ) => Promise<{ saved: boolean; destPath?: string }>
    }
  }
}
