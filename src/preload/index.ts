import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ffmpegApi } from './ffmpeg/index'
// Custom APIs for renderer
const api = {
  saveAs: (
    sourcePath: string,
    options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }
  ): Promise<{ saved: boolean; destPath?: string }> =>
    ipcRenderer.invoke('save-as', {
      sourcePath,
      defaultPath: options?.defaultPath,
      filters: options?.filters
    })
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('ffmpeg', ffmpegApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.ffmpeg = ffmpegApi
  // @ts-ignore (define in dts)
  window.api = api
}
