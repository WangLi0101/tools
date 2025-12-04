import { ipcRenderer } from 'electron'

export interface DownloadApi {
  startDownload: (
    url: string,
    filePath: string,
    id: string,
    resumeBytes?: number
  ) => Promise<{ success: boolean; error?: string }>
  pauseDownload: (id: string) => Promise<{ success: boolean; error?: string }>
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
  onPaused: (
    callback: (data: { id: string; receivedBytes: number; totalBytes: number }) => void
  ) => () => void
}

export const downloadApi: DownloadApi = {
  startDownload: (url: string, filePath: string, id: string, resumeBytes = 0) => {
    return ipcRenderer.invoke('download-file', { url, filePath, id, resumeBytes })
  },
  pauseDownload: (id: string) => {
    return ipcRenderer.invoke('download-pause', { id })
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
  },
  onPaused: (
    callback: (data: { id: string; receivedBytes: number; totalBytes: number }) => void
  ) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('download-paused', handler)
    return () => ipcRenderer.removeListener('download-paused', handler)
  }
}
