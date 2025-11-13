declare module 'ffmpeg' {
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
    convertMedia: (
      task: 'image' | 'video' | 'audio',
      options: ConvertImageOptions | ConvertVideoOptions | ConvertAudioOptions
    ) => Promise<ConvertImageResult | ConvertVideoResult | ConvertAudioResult>
    onConvertStatus: (
      task: 'image' | 'video' | 'audio',
      listener: (payload: ConvertImageStatus | ConvertVideoStatus | ConvertAudioStatus) => void
    ) => () => void
  }
}

declare global {
  interface Window {
    ffmpeg: import('ffmpeg').FfmpegApi
  }
}

export {}
