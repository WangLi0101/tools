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

type CompressImageFormat = 'jpg' | 'png' | 'webp'
interface CompressImageOptions {
  inputPath: string
  outputFormat: CompressImageFormat
  quality?: number
  width?: number
  height?: number
}
interface CompressImageResult {
  outputPath: string
}
interface CompressImageStatus {
  status: 'start' | 'progress' | 'done' | 'error'
  progress?: number
  message?: string
  outputPath?: string
}

type CompressVideoFormat = 'mp4' | 'webm'
interface CompressVideoOptions {
  inputPath: string
  outputFormat: CompressVideoFormat
  width?: number
  height?: number
  crf?: number
  preset?:
    | 'ultrafast'
    | 'superfast'
    | 'veryfast'
    | 'faster'
    | 'fast'
    | 'medium'
    | 'slow'
    | 'slower'
    | 'veryslow'
  audioBitrate?: string
}
interface CompressVideoResult {
  outputPath: string
}
interface CompressVideoStatus {
  status: 'start' | 'progress' | 'done' | 'error'
  progress?: number
  message?: string
  outputPath?: string
}

type CompressAudioFormat = 'mp3' | 'aac' | 'ogg'
interface CompressAudioOptions {
  inputPath: string
  outputFormat: CompressAudioFormat
  audioBitrate?: string
}
interface CompressAudioResult {
  outputPath: string
}
interface CompressAudioStatus {
  status: 'start' | 'progress' | 'done' | 'error'
  progress?: number
  message?: string
  outputPath?: string
}

interface M3u8TaskOptions {
  taskId: string
  url: string
  outputDir: string
  filename: string
  format?: 'mp4' | 'ts'
  headers?: Record<string, string>
}
interface M3u8Status {
  taskId: string
  status: 'start' | 'progress' | 'done' | 'error' | 'paused' | 'canceled'
  progress?: number
  speed?: string
  bitrate?: string
  message?: string
  outputPath?: string
}
export interface GroupMergeOptions {
  outputDir: string
  group: {
    name: string
    files: string[]
  }[]
}
interface GroupMergeStPayload {
  groupName: string
  status: 'start' | 'progress' | 'done' | 'error' | 'canceled'
}
export interface FfmpegApi {
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

  compressImage: (options: CompressImageOptions) => Promise<CompressImageResult>
  onCompressImageStatus: (listener: (payload: CompressImageStatus) => void) => () => void
  compressVideo: (options: CompressVideoOptions) => Promise<CompressVideoResult>
  onCompressVideoStatus: (listener: (payload: CompressVideoStatus) => void) => () => void
  compressAudio: (options: CompressAudioOptions) => Promise<CompressAudioResult>
  onCompressAudioStatus: (listener: (payload: CompressAudioStatus) => void) => () => void

  startM3u8: (options: M3u8TaskOptions) => Promise<void>
  cancelM3u8: (taskId: string) => Promise<void>
  onM3u8Status: (listener: (payload: M3u8Status) => void) => () => void

  mergeVideos: (options: {
    inputDir: string
    outputDir: string
    formats?: string[]
    noProgress?: boolean
  }) => Promise<void>
  cancelVideoMerge: () => Promise<void>
  onVideoMergeStatus: (
    listener: (payload: {
      status: 'start' | 'progress' | 'done' | 'error' | 'canceled'
      progress?: number
      message?: string
      outputPath?: string
      total?: number
      phase?: 'scan' | 'merge'
      scanCount?: number
      scanTotal?: number
      noProgress?: boolean
    }) => void
  ) => () => void

  scanVideoGruopFiles: (options: {
    inputDir: string
    formats: string[]
  }) => Promise<{ files: { url: string; createTime: number }[] }>
  // 合并视频
  groupMergeStart(options: GroupMergeOptions): Promise<void>
  // 合并视频监听
  onGroupMergeStatus: (listener: (payload: GroupMergeStPayload) => void) => () => void
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
  },

  compressImage: (options) => ipcRenderer.invoke('compressImage', options),
  onCompressImageStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => listener(payload)
    ipcRenderer.on('compressImage-status', handler)
    return () => ipcRenderer.removeListener('compressImage-status', handler)
  },
  compressVideo: (options) => ipcRenderer.invoke('compressVideo', options),
  onCompressVideoStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => listener(payload)
    ipcRenderer.on('compressVideo-status', handler)
    return () => ipcRenderer.removeListener('compressVideo-status', handler)
  },
  compressAudio: (options) => ipcRenderer.invoke('compressAudio', options),
  onCompressAudioStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => listener(payload)
    ipcRenderer.on('compressAudio-status', handler)
    return () => ipcRenderer.removeListener('compressAudio-status', handler)
  },

  startM3u8: (options) => ipcRenderer.invoke('m3u8-start', options),
  cancelM3u8: (taskId) => ipcRenderer.invoke('m3u8-cancel', taskId),
  onM3u8Status: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => listener(payload)
    ipcRenderer.on('m3u8-status', handler)
    return () => ipcRenderer.removeListener('m3u8-status', handler)
  },

  mergeVideos: (options) => ipcRenderer.invoke('videoMerge-start', options),
  cancelVideoMerge: () => ipcRenderer.invoke('videoMerge-cancel'),
  onVideoMergeStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => listener(payload)
    ipcRenderer.on('videoMerge-status', handler)
    return () => ipcRenderer.removeListener('videoMerge-status', handler)
  },

  scanVideoGruopFiles: (options) => ipcRenderer.invoke('videoGroup-scan', options),
  // 合并视频
  groupMergeStart: (options) => ipcRenderer.invoke('videoGroup-merge', options),
  // 合并视频监听
  onGroupMergeStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: GroupMergeStPayload) =>
      listener(payload)
    ipcRenderer.on('videoGroup-status', handler)
    return () => ipcRenderer.removeListener('videoGroup-status', handler)
  }
}
