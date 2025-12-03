import { ipcRenderer } from 'electron'

export interface DownloadApi {
  startDownload: (
    url: string,
    filePath: string,
    id: string
  ) => Promise<{ success: boolean; error?: string }>
  onProgress: (
    callback: (data: {
      id: string
      progress: number
      receivedBytes: number
      totalBytes: number
      speed: number
    }) => void
  ) => () => void
  onComplete: (callback: (data: { id: string; filePath: string }) => void) => () => void
  onError: (callback: (data: { id: string; error: string }) => void) => () => void
}

export const downloadApi: DownloadApi = {
  startDownload: (url: string, filePath: string, id: string) => {
    return ipcRenderer.invoke('download-file', { url, filePath, id })
  },
  onProgress: (
    callback: (data: {
      id: string
      progress: number
      receivedBytes: number
      totalBytes: number
      speed: number
    }) => void
  ) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },
  onComplete: (callback: (data: { id: string; filePath: string }) => void) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('download-complete', handler)
    return () => ipcRenderer.removeListener('download-complete', handler)
  },
  onError: (callback: (data: { id: string; error: string }) => void) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('download-error', handler)
    return () => ipcRenderer.removeListener('download-error', handler)
  }
}
