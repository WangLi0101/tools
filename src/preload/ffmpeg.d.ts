declare global {
  interface Window {
    ffmpeg: {
      convertImage: (options: {
        inputPath: string
        outputFormat: 'jpg' | 'png' | 'webp' | 'gif'
        quality?: number
        width?: number
        height?: number
      }) => Promise<{ outputPath: string }>
      onConvertImageStatus: (
        listener: (payload: {
          status: 'start' | 'progress' | 'done' | 'error'
          progress?: number
          message?: string
          outputPath?: string
        }) => void
      ) => () => void
      convertVideo: (options: {
        inputPath: string
        outputFormat: 'mp4' | 'webm' | 'mov' | 'mkv'
        width?: number
        height?: number
        videoBitrate?: string
        audioBitrate?: string
      }) => Promise<{ outputPath: string }>
      onConvertVideoStatus: (
        listener: (payload: {
          status: 'start' | 'progress' | 'done' | 'error'
          progress?: number
          message?: string
          outputPath?: string
        }) => void
      ) => () => void
      convertAudio: (options: {
        inputPath: string
        outputFormat: 'mp3' | 'aac' | 'wav' | 'flac' | 'ogg'
        audioBitrate?: string
      }) => Promise<{ outputPath: string }>
      onConvertAudioStatus: (
        listener: (payload: {
          status: 'start' | 'progress' | 'done' | 'error'
          progress?: number
          message?: string
          outputPath?: string
        }) => void
      ) => () => void
    }
  }
}

export {}
