import { ipcRenderer } from 'electron'

type ImageFormat = 'jpg' | 'png' | 'webp' | 'gif'
interface ConvertImageOptions {
  inputPath: string
  outputFormat: ImageFormat
  quality?: number
  width?: number
  height?: number
}
interface ConvertImageResult {
  outputPath: string
}
interface ConvertImageStatus {
  status: 'start' | 'progress' | 'done' | 'error'
  progress?: number
  message?: string
  outputPath?: string
}
type VideoFormat = 'mp4' | 'webm' | 'mov' | 'mkv'
interface ConvertVideoOptions {
  inputPath: string
  outputFormat: VideoFormat
  width?: number
  height?: number
  videoBitrate?: string
  audioBitrate?: string
}
interface ConvertVideoResult {
  outputPath: string
}
interface ConvertVideoStatus {
  status: 'start' | 'progress' | 'done' | 'error'
  progress?: number
  message?: string
  outputPath?: string
}
type AudioFormat = 'mp3' | 'aac' | 'wav' | 'flac' | 'ogg'
interface ConvertAudioOptions {
  inputPath: string
  outputFormat: AudioFormat
  audioBitrate?: string
}
interface ConvertAudioResult {
  outputPath: string
}
interface ConvertAudioStatus {
  status: 'start' | 'progress' | 'done' | 'error'
  progress?: number
  message?: string
  outputPath?: string
}
interface FfmpegApi {
  convertImage: (options: ConvertImageOptions) => Promise<ConvertImageResult>
  onConvertImageStatus: (listener: (payload: ConvertImageStatus) => void) => () => void
  convertVideo: (options: ConvertVideoOptions) => Promise<ConvertVideoResult>
  onConvertVideoStatus: (listener: (payload: ConvertVideoStatus) => void) => () => void
  convertAudio: (options: ConvertAudioOptions) => Promise<ConvertAudioResult>
  onConvertAudioStatus: (listener: (payload: ConvertAudioStatus) => void) => () => void
  cancelImage: () => Promise<void>
  cancelVideo: () => Promise<void>
  cancelAudio: () => Promise<void>
  convertMedia: (
    task: 'image' | 'video' | 'audio',
    options: ConvertImageOptions | ConvertVideoOptions | ConvertAudioOptions
  ) => Promise<ConvertImageResult | ConvertVideoResult | ConvertAudioResult>
  onConvertStatus: (
    task: 'image' | 'video' | 'audio',
    listener: (payload: ConvertImageStatus | ConvertVideoStatus | ConvertAudioStatus) => void
  ) => () => void
}

export const ffmpegApi: FfmpegApi = {
  convertImage: (options) => ipcRenderer.invoke('convertImage', options),
  onConvertImageStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => {
      listener(payload)
    }
    ipcRenderer.on('convertImage-status', handler)
    return () => ipcRenderer.removeListener('convertImage-status', handler)
  },
  convertVideo: (options) => ipcRenderer.invoke('convertVideo', options),
  onConvertVideoStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => {
      listener(payload)
    }
    ipcRenderer.on('convertVideo-status', handler)
    return () => ipcRenderer.removeListener('convertVideo-status', handler)
  },
  convertAudio: (options) => ipcRenderer.invoke('convertAudio', options),
  onConvertAudioStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => {
      listener(payload)
    }
    ipcRenderer.on('convertAudio-status', handler)
    return () => ipcRenderer.removeListener('convertAudio-status', handler)
  },
  cancelImage: () => ipcRenderer.invoke('cancelImage'),
  cancelVideo: () => ipcRenderer.invoke('cancelVideo'),
  cancelAudio: () => ipcRenderer.invoke('cancelAudio'),
  convertMedia: (task, options) => {
    const map = {
      image: 'convertImage',
      video: 'convertVideo',
      audio: 'convertAudio'
    } as const
    return ipcRenderer.invoke(map[task], options as any)
  },
  onConvertStatus: (task, listener) => {
    const map = {
      image: 'convertImage-status',
      video: 'convertVideo-status',
      audio: 'convertAudio-status'
    } as const
    const channel = map[task]
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => {
      listener(payload)
    }
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}
