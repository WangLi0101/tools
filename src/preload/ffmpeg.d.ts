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
    }
  }
}

export {}