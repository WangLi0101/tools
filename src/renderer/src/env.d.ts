/// <reference types="vite/client" />

declare global {
  interface File extends File {
    path: string
  }
}

export interface ChromeDesktopVideoConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: 'desktop'
    chromeMediaSourceId: string
    maxWidth?: number
    maxHeight?: number
    maxFrameRate?: number
  }
  optional?: any[]
}

export interface ChromeDesktopAudioConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: 'desktop'
    chromeMediaSourceId: string
  }
  optional?: any[]
}
