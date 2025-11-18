import { ipcRenderer } from 'electron'

export interface RecordApi {
  start: (outDir: string) => Promise<void>
  stop: () => Promise<void>
  pushData: (data: ArrayBuffer) => Promise<void>
}

export const recordApi: RecordApi = {
  start: (outDir) => ipcRenderer.invoke('record-start', outDir),
  stop: () => ipcRenderer.invoke('record-stop'),
  pushData: (data) => ipcRenderer.invoke('record-push-data', data)
}
