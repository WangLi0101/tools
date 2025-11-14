import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from 'Api'
import type { FfmpegApi } from 'ffmpeg'
import type { PlaywrightApi } from './playwright'
declare global {
  interface Window {
    electron: ElectronAPI
    ffmpeg: FfmpegApi
    api: Api
    playwright: PlaywrightApi
  }
}
