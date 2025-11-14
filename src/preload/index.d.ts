import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from 'Api'
import type { FfmpegApi } from 'ffmpeg'

declare global {
  interface Window {
    electron: ElectronAPI
    ffmpeg: FfmpegApi
    api: Api
  }
}
