import { RecordApi } from './record/index'
import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from './api'
import type { FfmpegApi } from './ffmpeg'
import type { PlaywrightApi } from './playwright'
import type { DownloadApi } from './download'
declare global {
  interface Window {
    electron: ElectronAPI
    ffmpeg: FfmpegApi
    api: Api
    playwright: PlaywrightApi
    record: RecordApi
    download: DownloadApi
  }
}
