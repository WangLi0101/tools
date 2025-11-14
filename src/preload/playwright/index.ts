import { ipcRenderer } from 'electron'

export interface PlaywrightApi {
  exportPdf: (url: string) => Promise<string>
}

export const playwrightApi: PlaywrightApi = {
  exportPdf: (url) => ipcRenderer.invoke('export-pdf', url)
}
