import { ipcMain } from 'electron'
import { spawn, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'

let currentImageProc: any
let currentVideoProc: any
let currentAudioProc: any

const hmsToSeconds = (h: number, m: number, s: number): number => h * 3600 + m * 60 + s

const parseTimeFromLine = (line: string): number | undefined => {
  const m = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/)
  if (!m) return undefined
  const h = Number(m[1])
  const mn = Number(m[2])
  const sec = Number(m[3])
  if (Number.isFinite(h) && Number.isFinite(mn) && Number.isFinite(sec)) {
    return hmsToSeconds(h, mn, sec)
  }
  return undefined
}

const probeDurationSeconds = (inputPath: string): number | undefined => {
  try {
    const res = spawnSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      inputPath
    ])
    const out = String(res.stdout || '').trim()
    const val = Number(out)
    if (Number.isFinite(val) && val > 0) return val
  } catch (err) {
    console.error('probeDurationSeconds error', err)
  }
  return undefined
}

const runFfmpeg = (
  event: Electron.IpcMainInvokeEvent,
  channel: string,
  args: string[],
  outputPath: string,
  inputPath?: string,
  onSpawn?: (p: any) => void
): Promise<void> => {
  const durationSec = inputPath ? probeDurationSeconds(inputPath) : undefined
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    if (onSpawn) onSpawn(proc)
    proc.stderr.on('data', (data) => {
      const line = String(data)
      let progress: number | undefined
      const t = parseTimeFromLine(line)
      if (durationSec && t && t >= 0) {
        const pct = Math.min(99, (t / durationSec) * 100)
        progress = Number(pct.toFixed(1))
      }
      event.sender.send(channel, { status: 'progress', message: line, progress })
    })
    proc.on('error', (err) => {
      event.sender.send(channel, { status: 'error', message: String(err) })
      reject(err)
    })
    proc.on('close', (code) => {
      if (proc.killed) {
        event.sender.send(channel, { status: 'canceled' })
        resolve()
        return
      }
      if (code === 0 && fs.existsSync(outputPath)) {
        event.sender.send(channel, { status: 'done', outputPath })
        resolve()
      } else {
        const msg = `ffmpeg exited with code ${code}`
        event.sender.send(channel, { status: 'error', message: msg })
        reject(new Error(msg))
      }
    })
  })
}

export const registerFfmpegIPC = (): void => {
  ipcMain.handle('convertImage', async (event, args) => {
    const { inputPath, outputFormat, quality, width, height } = args as {
      inputPath: string
      outputFormat: 'jpg' | 'png' | 'webp' | 'gif'
      quality?: number
      width?: number
      height?: number
    }

    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    const ext = outputFormat === 'jpg' ? 'jpg' : outputFormat
    const outputPath = path.join(dir, `${base}_converted.${ext}`)

    event.sender.send('convertImage-status', { status: 'start' })

    const ffArgs: string[] = ['-y', '-i', inputPath]

    if (typeof width === 'number' || typeof height === 'number') {
      const w = typeof width === 'number' ? width : -1
      const h = typeof height === 'number' ? height : -1
      ffArgs.push('-vf', `scale=${w}:${h}`)
    }

    if (ext === 'jpg') {
      if (typeof quality === 'number') {
        const q = Math.max(2, Math.min(31, Math.round(31 - (quality / 100) * 29)))
        ffArgs.push('-q:v', String(q))
      }
    }

    if (ext === 'webp') {
      ffArgs.push('-c:v', 'libwebp')
      if (typeof quality === 'number') {
        ffArgs.push('-quality', String(Math.max(0, Math.min(100, Math.round(quality)))))
      }
    }

    if (ext === 'gif') {
      ffArgs.push('-loop', '0')
    }

    ffArgs.push(outputPath)

    await runFfmpeg(event, 'convertImage-status', ffArgs, outputPath, inputPath, (p) => {
      currentImageProc = p
    })

    return { outputPath }
  })

  ipcMain.handle('convertVideo', async (event, args) => {
    const { inputPath, outputFormat, width, height, videoBitrate, audioBitrate } = args as {
      inputPath: string
      outputFormat: 'mp4' | 'webm' | 'mov' | 'mkv'
      width?: number
      height?: number
      videoBitrate?: string
      audioBitrate?: string
    }

    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    const ext = outputFormat
    const outputPath = path.join(dir, `${base}_converted.${ext}`)

    event.sender.send('convertVideo-status', { status: 'start' })

    const ffArgs: string[] = ['-y', '-i', inputPath]

    if (typeof width === 'number' || typeof height === 'number') {
      const w = typeof width === 'number' ? width : -1
      const h = typeof height === 'number' ? height : -1
      ffArgs.push('-vf', `scale=${w}:${h}`)
    }

    if (videoBitrate) ffArgs.push('-b:v', videoBitrate)
    if (audioBitrate) ffArgs.push('-b:a', audioBitrate)

    if (ext === 'mp4') {
      ffArgs.push('-c:v', 'libx264')
      ffArgs.push('-c:a', 'aac')
      ffArgs.push('-movflags', '+faststart')
    }
    if (ext === 'webm') {
      ffArgs.push('-c:v', 'libvpx-vp9')
      ffArgs.push('-c:a', 'libopus')
    }
    if (ext === 'mov') {
      ffArgs.push('-c:v', 'prores_ks')
      ffArgs.push('-c:a', 'aac')
    }
    if (ext === 'mkv') {
      ffArgs.push('-c:v', 'libx264')
      ffArgs.push('-c:a', 'aac')
    }

    ffArgs.push(outputPath)

    await runFfmpeg(event, 'convertVideo-status', ffArgs, outputPath, inputPath, (p) => {
      currentVideoProc = p
    })

    return { outputPath }
  })

  ipcMain.handle('convertAudio', async (event, args) => {
    const { inputPath, outputFormat, audioBitrate } = args as {
      inputPath: string
      outputFormat: 'mp3' | 'aac' | 'wav' | 'flac' | 'ogg'
      audioBitrate?: string
    }

    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    const ext = outputFormat
    const outputPath = path.join(dir, `${base}_converted.${ext}`)

    event.sender.send('convertAudio-status', { status: 'start' })

    const ffArgs: string[] = ['-y', '-i', inputPath, '-vn']

    if (audioBitrate) ffArgs.push('-b:a', audioBitrate)

    if (ext === 'mp3') ffArgs.push('-c:a', 'libmp3lame')
    if (ext === 'aac') ffArgs.push('-c:a', 'aac')
    if (ext === 'wav') ffArgs.push('-c:a', 'pcm_s16le')
    if (ext === 'flac') ffArgs.push('-c:a', 'flac')
    if (ext === 'ogg') ffArgs.push('-c:a', 'libvorbis')

    ffArgs.push(outputPath)

    await runFfmpeg(event, 'convertAudio-status', ffArgs, outputPath, inputPath, (p) => {
      currentAudioProc = p
    })

    return { outputPath }
  })

  ipcMain.handle('cancelImage', async () => {
    if (currentImageProc) {
      try {
        currentImageProc.kill('SIGINT')
      } finally {
        currentImageProc = null
      }
    }
  })

  ipcMain.handle('cancelVideo', async () => {
    if (currentVideoProc) {
      try {
        currentVideoProc.kill('SIGINT')
      } finally {
        currentVideoProc = null
      }
    }
  })

  ipcMain.handle('cancelAudio', async () => {
    if (currentAudioProc) {
      try {
        currentAudioProc.kill('SIGINT')
      } finally {
        currentAudioProc = null
      }
    }
  })
}
