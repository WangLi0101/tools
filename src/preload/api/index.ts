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
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => void
  onUpdateStatus: (
    listener: (payload: {
      status:
        | 'checking'
        | 'update-available'
        | 'update-not-available'
        | 'download-progress'
        | 'update-downloaded'
        | 'error'
      info?: any
      percent?: number
      transferred?: number
      total?: number
      bytesPerSecond?: number
      message?: string
    }) => void
  ) => () => void
  getMediaSource: () => Promise<Electron.DesktopCapturerSource[]>
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
  getDiskSpace: (dir) => ipcRenderer.invoke('get-disk-space', dir),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => listener(payload)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
  getMediaSource: () => ipcRenderer.invoke('get-media-source')
}
