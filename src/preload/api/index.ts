import { ipcRenderer } from 'electron'
export interface Api {
  saveAs: (
    sourcePath: string,
    options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }
  ) => Promise<{ saved: boolean; destPath?: string }>
  quit: () => void
  minimize: () => void
}

export const api: Api = {
  saveAs: (sourcePath, options): Promise<{ saved: boolean; destPath?: string }> =>
    ipcRenderer.invoke('save-as', {
      sourcePath,
      defaultPath: options?.defaultPath,
      filters: options?.filters
    }),
  quit: () => ipcRenderer.send('quit'),
  minimize: () => ipcRenderer.send('minimize-window')
}
