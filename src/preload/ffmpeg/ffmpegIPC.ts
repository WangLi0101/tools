import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import http from 'http'
import https from 'https'

let currentImageProc: any
let currentVideoProc: any
let currentAudioProc: any
const m3u8Procs = new Map<string, any>()
const m3u8States = new Map<string, 'running' | 'paused' | 'stopped'>()

const getBin = (name: 'ffmpeg' | 'ffprobe'): string => {
  if (process.platform === 'darwin') return name
  const ext = process.platform === 'win32' ? '.exe' : ''
  const filename = name + ext
  const byRes = path.join(process.resourcesPath, filename)
  if (fs.existsSync(byRes)) return byRes
  const dev = path.join(__dirname, '../../../resources', filename)
  if (fs.existsSync(dev)) return dev
  return name
}

const FFMPEG_CMD = getBin('ffmpeg')
const FFPROBE_CMD = getBin('ffprobe')
let currentMergeProc: any

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

/**
 * 探测文件时长（秒）
 */
const probeDurationSeconds = async (input: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const p = spawn(FFPROBE_CMD, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      input
    ])
    let out = ''
    p.stdout.on('data', (d) => (out += d.toString()))
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffprobe failed'))
      const dur = parseFloat(out.trim())
      if (isNaN(dur)) return reject(new Error('cannot get duration'))
      resolve(dur)
    })
  })
}

const fetchText = async (u: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const lib = u.startsWith('https') ? https : http
      const req = lib.get(u, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchText(res.headers.location).then(resolve, reject)
          return
        }
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode || 0}`))
          return
        }
        let data = ''
        res.on('data', (d) => (data += d.toString()))
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
    } catch (e) {
      reject(e)
    }
  })
}

const parseM3u8Duration = (text: string): number | undefined => {
  let total = 0
  // Try different formats for EXTINF duration
  const re = /#EXTINF:([\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[1])
    if (!isNaN(n)) total += n
  }

  // Also try to find target duration for better estimation
  const targetDurationMatch = text.match(/#EXT-X-TARGETDURATION:(\d+)/)
  if (targetDurationMatch && total === 0) {
    // If no segments found but target duration exists, estimate based on segments count
    const segments = text.match(/#EXTINF:/g)
    if (segments && segments.length > 0) {
      const targetDuration = parseInt(targetDurationMatch[1])
      total = segments.length * targetDuration
    }
  }

  if (Number.isFinite(total) && total > 0) return total
  return undefined
}

const probePlaylistDurationSeconds = async (input: string): Promise<number | undefined> => {
  try {
    const d = await probeDurationSeconds(input)
    if (Number.isFinite(d) && d > 0) return d
  } catch {}
  try {
    const text = await fetchText(input)
    const total = parseM3u8Duration(text)
    return total
  } catch {}
  return undefined
}

const runFfmpeg = async (
  event: Electron.IpcMainInvokeEvent,
  channel: string,
  args: string[],
  outputPath: string,
  inputPath?: string,
  onSpawn?: (p: any) => void,
  totalDurationSec?: number
): Promise<void> => {
  const durationSec =
    typeof totalDurationSec === 'number'
      ? totalDurationSec
      : inputPath
        ? await probeDurationSeconds(inputPath)
        : undefined
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG_CMD, args)
    if (onSpawn) onSpawn(proc)
    proc.stderr.on('data', (data) => {
      const line = String(data)
      let progress: number | undefined
      const t = parseTimeFromLine(line)
      if (durationSec && t && t >= 0) {
        const pct = Math.min(99, (t / durationSec) * 100)
        progress = Number(pct.toFixed(1))
      }
      const payload: any = { status: 'progress', message: line }
      if (typeof progress === 'number') payload.progress = progress
      event.sender.send(channel, payload)
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

  ipcMain.handle('compressImage', async (event, args) => {
    const { inputPath, outputFormat, quality, width, height } = args as {
      inputPath: string
      outputFormat: 'jpg' | 'png' | 'webp'
      quality?: number
      width?: number
      height?: number
    }

    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    const ext = outputFormat
    const outputPath = path.join(dir, `${base}_compressed.${ext}`)

    event.sender.send('compressImage-status', { status: 'start' })

    const ffArgs: string[] = ['-y', '-i', inputPath]

    if (typeof width === 'number' || typeof height === 'number') {
      const w = typeof width === 'number' ? width : -1
      const h = typeof height === 'number' ? height : -1
      ffArgs.push('-vf', `scale=${w}:${h}`)
    }

    ffArgs.push('-map_metadata', '-1')

    if (ext === 'jpg') {
      if (typeof quality === 'number') {
        const q = Math.max(2, Math.min(31, Math.round(31 - (quality / 100) * 29)))
        ffArgs.push('-q:v', String(q))
      }
    }
    if (ext === 'png') {
      ffArgs.push('-compression_level', '9')
    }
    if (ext === 'webp') {
      ffArgs.push('-c:v', 'libwebp')
      if (typeof quality === 'number') {
        ffArgs.push('-quality', String(Math.max(0, Math.min(100, Math.round(quality)))))
      } else {
        ffArgs.push('-quality', '80')
      }
    }

    ffArgs.push(outputPath)

    await runFfmpeg(event, 'compressImage-status', ffArgs, outputPath, inputPath, (p) => {
      currentImageProc = p
    })

    return { outputPath }
  })

  ipcMain.handle('compressVideo', async (event, args) => {
    const {
      inputPath,
      outputFormat,
      width,
      height,
      crf = 28,
      preset = 'medium',
      audioBitrate
    } = (args || {}) as {
      inputPath: string
      outputFormat: 'mp4' | 'webm'
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

    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    const ext = outputFormat
    const outputPath = path.join(dir, `${base}_compressed.${ext}`)

    event.sender.send('compressVideo-status', { status: 'start' })

    const ffArgs: string[] = ['-y', '-i', inputPath]

    if (typeof width === 'number' || typeof height === 'number') {
      const w = typeof width === 'number' ? width : -1
      const h = typeof height === 'number' ? height : -1
      ffArgs.push('-vf', `scale=${w}:${h}`)
    }

    ffArgs.push('-map_metadata', '-1')

    if (ext === 'mp4') {
      ffArgs.push('-c:v', 'libx264')
      ffArgs.push('-preset', preset)
      ffArgs.push('-crf', String(Math.max(0, Math.min(51, Math.round(crf)))))
      ffArgs.push('-c:a', 'aac')
      if (audioBitrate) ffArgs.push('-b:a', audioBitrate)
      ffArgs.push('-movflags', '+faststart')
    }
    if (ext === 'webm') {
      ffArgs.push('-c:v', 'libvpx-vp9')
      ffArgs.push('-crf', String(Math.max(0, Math.min(63, Math.round(crf)))))
      ffArgs.push('-b:v', '0')
      ffArgs.push('-c:a', 'libopus')
      if (audioBitrate) ffArgs.push('-b:a', audioBitrate)
    }

    ffArgs.push(outputPath)

    await runFfmpeg(event, 'compressVideo-status', ffArgs, outputPath, inputPath, (p) => {
      currentVideoProc = p
    })

    return { outputPath }
  })

  ipcMain.handle('compressAudio', async (event, args) => {
    const { inputPath, outputFormat, audioBitrate } = (args || {}) as {
      inputPath: string
      outputFormat: 'mp3' | 'aac' | 'ogg'
      audioBitrate?: string
    }

    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    const ext = outputFormat
    const outputPath = path.join(dir, `${base}_compressed.${ext}`)

    event.sender.send('compressAudio-status', { status: 'start' })

    const ffArgs: string[] = ['-y', '-i', inputPath, '-vn', '-map_metadata', '-1']

    if (audioBitrate) ffArgs.push('-b:a', audioBitrate)

    if (ext === 'mp3') ffArgs.push('-c:a', 'libmp3lame')
    if (ext === 'aac') ffArgs.push('-c:a', 'aac')
    if (ext === 'ogg') ffArgs.push('-c:a', 'libopus')

    ffArgs.push(outputPath)

    await runFfmpeg(event, 'compressAudio-status', ffArgs, outputPath, inputPath, (p) => {
      currentAudioProc = p
    })

    return { outputPath }
  })

  ipcMain.handle('m3u8-start', async (event, args) => {
    const {
      taskId,
      url,
      outputDir,
      filename,
      format = 'mp4'
    } = args as {
      taskId: string
      url: string
      outputDir: string
      filename: string
      format?: 'mp4' | 'ts'
    }
    const ext = format === 'ts' ? 'ts' : 'mp4'
    const outputPath = path.join(
      outputDir,
      filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
    )
    event.sender.send('m3u8-status', { taskId, status: 'start' })
    const ffArgs: string[] = ['-y']

    ffArgs.push('-i', url)
    ffArgs.push('-progress', 'pipe:1')
    if (ext === 'mp4') ffArgs.push('-c', 'copy', '-bsf:a', 'aac_adtstoasc')
    else ffArgs.push('-c', 'copy')

    // Try to get duration, but don't fail if we can't
    let durationSec: number | undefined
    try {
      durationSec = await probePlaylistDurationSeconds(url)
    } catch (error) {
      console.log('Could not determine duration:', error)
    }

    const proc = spawn(FFMPEG_CMD, [...ffArgs, outputPath])
    m3u8Procs.set(taskId, proc)
    m3u8States.set(taskId, 'running')

    // Track progress even without duration
    let lastProgress = 0
    let lastTime = 0

    proc.stdout.on('data', (data) => {
      const text = String(data)
      const m = text.match(/out_time_ms=(\d+)/)
      if (m) {
        const v = Number(m[1])
        if (Number.isFinite(v) && v >= 0) {
          const t = v / 1000000

          if (durationSec && durationSec > 0) {
            // Normal progress calculation with duration
            const progress = Number(Math.min(99, (t / durationSec) * 100).toFixed(1))
            event.sender.send('m3u8-status', { taskId, status: 'progress', progress })
          } else {
            // Fallback: estimate progress based on time elapsed
            // This is not perfect but gives user feedback
            if (t > lastTime) {
              lastTime = t
              // Gradually increase progress, but cap at 95% until completion
              const estimatedProgress = Math.min(95, lastProgress + 0.5)
              lastProgress = estimatedProgress
              event.sender.send('m3u8-status', {
                taskId,
                status: 'progress',
                progress: estimatedProgress
              })
            }
          }
        }
      }
    })
    proc.stderr.on('data', (data) => {
      const line = String(data)
      const speed = line.match(/speed=\s*([\d.]+x)/)?.[1]
      const bitrate = line.match(/bitrate=\s*([\d.]+kbits\/s)/)?.[1]
      event.sender.send('m3u8-status', {
        taskId,
        status: 'progress',
        speed,
        bitrate,
        message: line
      })
    })
    proc.on('error', (err) => {
      event.sender.send('m3u8-status', { taskId, status: 'error', message: String(err) })
    })
    proc.on('close', (code) => {
      // Clean up process state
      m3u8States.set(taskId, 'stopped')

      // Only remove from map if the process is actually dead
      if (proc.killed || code !== null) {
        m3u8Procs.delete(taskId)
      }

      if (proc.killed) {
        event.sender.send('m3u8-status', { taskId, status: 'canceled' })
        return
      }
      if (code === 0 && fs.existsSync(outputPath)) {
        // Ensure progress shows 100% when completed
        event.sender.send('m3u8-status', { taskId, status: 'progress', progress: 100 })
        event.sender.send('m3u8-status', { taskId, status: 'done', outputPath })
      } else {
        event.sender.send('m3u8-status', {
          taskId,
          status: 'error',
          message: code ? `Process exited with code ${code}` : 'Unknown error'
        })
      }
    })
  })
  ipcMain.handle('m3u8-cancel', async (_event, taskId: string) => {
    const p = m3u8Procs.get(taskId)
    const state = m3u8States.get(taskId)

    if (p && state !== 'stopped' && !p.killed) {
      try {
        // Use SIGTERM first, then SIGKILL if needed
        p.kill('SIGTERM')
        m3u8States.set(taskId, 'stopped')

        // Give process time to terminate gracefully
        setTimeout(() => {
          if (!p.killed) {
            p.kill('SIGKILL')
          }
        }, 1000)
      } catch (err) {
        console.error(`[M3U8 ${taskId}] Failed to kill process:`, err)
      }
    } else {
      console.warn(`[M3U8 ${taskId}] Process not found, already killed, or stopped`)
    }
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

  ipcMain.handle('videoMerge-start', async (event, args) => {
    const { inputDir, outputDir, formats } = (args || {}) as {
      inputDir: string
      outputDir: string
      formats?: string[]
    }
    const channel = 'videoMerge-status'
    const defaultExts = [
      '.mp4',
      '.m4v',
      '.mov',
      '.avi',
      '.mkv',
      '.webm',
      '.ts',
      '.mts',
      '.m2ts',
      '.flv',
      '.wmv'
    ]
    const exts = (Array.isArray(formats) && formats.length
      ? Array.from(
          new Set(
            formats
              .map((s) => String(s || '').trim().toLowerCase())
              .filter(Boolean)
              .map((s) => (s.startsWith('.') ? s : `.${s}`))
          )
        )
      : defaultExts)

    const isVideoFile = (p: string): boolean => exts.includes(path.extname(p).toLowerCase())

    const scanRecursive = async (dir: string): Promise<string[]> => {
      const res: string[] = []
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const fp = path.join(dir, e.name)
        if (e.isDirectory()) {
          res.push(...(await scanRecursive(fp)))
        } else if (e.isFile() && isVideoFile(fp)) {
          res.push(fp)
        }
      }
      return res
    }

    const getCreationTime = async (file: string): Promise<number> => {
      try {
        const p = spawn(FFPROBE_CMD, [
          '-v',
          'error',
          '-show_entries',
          'format_tags=creation_time:stream_tags=creation_time',
          '-of',
          'default=noprint_wrappers=1',
          file
        ])
        let out = ''
        await new Promise<void>((resolve) => {
          p.stdout.on('data', (d) => (out += String(d)))
          p.on('close', () => resolve())
        })
        const m = out.match(/creation_time=(.*)/)
        if (m) {
          const s = m[1].trim()
          const t = Date.parse(s)
          if (Number.isFinite(t)) return t
        }
      } catch {}
      try {
        const st = await fs.promises.stat(file)
        return st.birthtimeMs || st.ctimeMs || Date.now()
      } catch {
        return Date.now()
      }
    }

    const getVideoProps = async (
      file: string
    ): Promise<{ vcodec?: string; acodec?: string; w?: number; h?: number; fps?: number }> => {
      const res: { vcodec?: string; acodec?: string; w?: number; h?: number; fps?: number } = {}
      try {
        const pv = spawn(FFPROBE_CMD, [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=codec_name,width,height,r_frame_rate',
          '-of',
          'csv=s=,:p=0',
          file
        ])
        let ov = ''
        await new Promise<void>((resolve) => {
          pv.stdout.on('data', (d) => (ov += String(d)))
          pv.on('close', () => resolve())
        })
        const parts = ov.trim().split(',')
        if (parts.length >= 4) {
          res.vcodec = parts[0]
          res.w = Number(parts[1])
          res.h = Number(parts[2])
          const fr = parts[3]
          const [a, b] = fr.split('/').map((x) => Number(x))
          if (Number.isFinite(a) && Number.isFinite(b) && b) res.fps = a / b
        }
      } catch {}
      try {
        const pa = spawn(FFPROBE_CMD, [
          '-v',
          'error',
          '-select_streams',
          'a:0',
          '-show_entries',
          'stream=codec_name',
          '-of',
          'csv=s=,:p=0',
          file
        ])
        let oa = ''
        await new Promise<void>((resolve) => {
          pa.stdout.on('data', (d) => (oa += String(d)))
          pa.on('close', () => resolve())
        })
        res.acodec = oa.trim() || undefined
      } catch {}
      return res
    }

    const fmtNow = (): string => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        '_' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
      )
    }

    const channelStart = (total?: number): void => event.sender.send(channel, { status: 'start', total })
    const channelError = (message: string): void =>
      event.sender.send(channel, { status: 'error', message })

    try {
      if (!inputDir || !outputDir) {
        channelError('参数不完整')
        return
      }
      const inStat = await fs.promises.stat(inputDir).catch(() => null as any)
      const outStat = await fs.promises.stat(outputDir).catch(() => null as any)
      if (!inStat || !inStat.isDirectory()) {
        channelError('输入文件夹不存在')
        return
      }
      if (!outStat || !outStat.isDirectory()) {
        await fs.promises.mkdir(outputDir, { recursive: true }).catch(() => null)
      }

      const files = await scanRecursive(inputDir)
      if (files.length === 0) {
        channelError('未找到视频文件')
        return
      }

      const metas: Array<{
        file: string
        ctime: number
        dur: number
        props: { vcodec?: string; acodec?: string; w?: number; h?: number; fps?: number }
        size: number
      }> = []

      for (const f of files) {
        try {
          const [ctime, dur, props, st] = await Promise.all([
            getCreationTime(f),
            probeDurationSeconds(f),
            getVideoProps(f),
            fs.promises.stat(f)
          ])
          if (!Number.isFinite(dur) || dur <= 0) continue
          metas.push({ file: f, ctime, dur, props, size: st.size })
        } catch {}
      }

      if (metas.length === 0) {
        channelError('没有有效的视频文件')
        return
      }

      channelStart(metas.length)

      metas.sort((a, b) => a.ctime - b.ctime)

      const totalDuration = metas.reduce((s, x) => s + (Number(x.dur) || 0), 0)
      const w = metas.map((m) => m.props.w || 0)
      const h = metas.map((m) => m.props.h || 0)
      const fps = metas.map((m) => m.props.fps || 0)

      const ts = fmtNow()
      const outPath = path.join(outputDir, `merged_${ts}.mp4`)
      const logPath = path.join(outputDir, `merged_${ts}.log`)
      const logStream = fs.createWriteStream(logPath, { flags: 'a' })
      logStream.write(`输入文件夹: ${inputDir}\n`)
      logStream.write(`输出文件: ${outPath}\n`)
      logStream.write(`共 ${metas.length} 个文件\n`)
      for (const m of metas) {
        logStream.write(
          `${m.file} | dur=${m.dur.toFixed(3)} | ` +
            `v=${m.props.vcodec || '-'} ${m.props.w || 0}x${m.props.h || 0} ${
              m.props.fps || 0
            }fps | a=${m.props.acodec || '-'} | ctime=${new Date(m.ctime).toISOString()}\n`
        )
      }

      {
        const args: string[] = ['-y']
        const n = metas.length
        const audioIndex: number[] = []
        let extraInputs = 0
        for (let i = 0; i < n; i++) {
          const m = metas[i]
          args.push('-i', m.file)
          const hasAudio = !!m.props.acodec
          if (hasAudio) {
            audioIndex.push(i)
          } else {
            args.push('-f', 'lavfi', '-t', m.dur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo')
            audioIndex.push(n + extraInputs)
            extraInputs++
          }
        }

        const targetW = Math.max(...w.filter((x) => Number.isFinite(x))) || metas[0].props.w || 1280
        const targetH = Math.max(...h.filter((x) => Number.isFinite(x))) || metas[0].props.h || 720
        const targetFps = Math.round(fps.find((x) => Number.isFinite(x) && x > 0) || 30)

        const chains: string[] = []
        for (let i = 0; i < n; i++) {
          chains.push(
            `[${i}:v:0]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,` +
              `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`
          )
          chains.push(
            `[${audioIndex[i]}:a:0]aformat=channel_layouts=stereo:sample_rates=48000,asetpts=PTS-STARTPTS[a${i}]`
          )
        }
        const concatInputs = Array.from({ length: n })
          .map((_, i) => `[v${i}][a${i}]`)
          .join('')
        const filter = `${chains.join(';')};${concatInputs}concat=n=${n}:v=1:a=1[v][a]`

        args.push('-filter_complex', filter, '-map', '[v]', '-map', '[a]')
        args.push('-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart')
        await runFfmpeg(
          event,
          channel,
          [...args, outPath],
          outPath,
          undefined,
          (p) => {
            currentMergeProc = p
            p.stderr.on('data', (d: any) => {
              logStream.write(String(d))
            })
          },
          totalDuration
        )
      }

      logStream.end()
      event.sender.send(channel, { status: 'done', outputPath: outPath })
    } catch (e) {
      const msg = String(e || '未知错误')
      event.sender.send('videoMerge-status', { status: 'error', message: msg })
    }
  })

  ipcMain.handle('videoMerge-cancel', async () => {
    if (currentMergeProc) {
      try {
        currentMergeProc.kill('SIGINT')
      } finally {
        currentMergeProc = null
      }
    }
  })
}
