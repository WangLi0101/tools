import { ipcRenderer } from 'electron'
export interface Api {
  saveAs: (
    sourcePath: string,
    options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }
  ) => Promise<{ saved: boolean; destPath?: string }>
  quit: () => void
  minimize: () => void
  selectDirectory: () => Promise<{ canceled: boolean; path?: string }>
  getDiskSpace: (dir: string) => Promise<{ totalBytes: number; freeBytes: number }>
}

export const api: Api = {
  saveAs: (sourcePath, options): Promise<{ saved: boolean; destPath?: string }> =>
    ipcRenderer.invoke('save-as', {
      sourcePath,
      defaultPath: options?.defaultPath,
      filters: options?.filters
    }),
  quit: () => ipcRenderer.send('quit'),
  minimize: () => ipcRenderer.send('minimize-window'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDiskSpace: (dir) => ipcRenderer.invoke('get-disk-space', dir)
}
