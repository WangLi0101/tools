import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ffmpegApi } from './ffmpeg/index'
import { api } from './api/index'
import { playwrightApi } from './playwright'
import { recordApi } from './record'
import { downloadApi } from './download'

// Custom APIs for renderer

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('ffmpeg', ffmpegApi)
    contextBridge.exposeInMainWorld('playwright', playwrightApi)
    contextBridge.exposeInMainWorld('record', recordApi)
    contextBridge.exposeInMainWorld('download', downloadApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.ffmpeg = ffmpegApi
  // @ts-ignore (define in dts)
  window.playwright = playwrightApi
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.download = downloadApi
}
