import { app, ipcMain, BrowserWindow } from 'electron'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import http from 'http'
import https from 'https'
import os from 'os'
import { GroupMergeOptions } from '.'

let currentImageProc: any
let currentVideoProc: any
let currentAudioProc: any
const m3u8Procs = new Map<string, any>()
const m3u8States = new Map<string, 'running' | 'paused' | 'stopped'>()
const IS_DEV = !app.isPackaged
const getBin = (name: 'ffmpeg' | 'ffprobe'): string => {
  if (process.platform === 'darwin') {
    if (IS_DEV) {
      return name
    }
    return path.join(process.resourcesPath, 'macFfmpeg', `${name}`)
  }
  if (IS_DEV) {
    return path.join(app.getAppPath(), 'resources', 'bin', `${name}`)
  }
  return path.join(process.resourcesPath, 'bin', `${name}`)
}

const FFMPEG_CMD = getBin('ffmpeg')
const FFPROBE_CMD = getBin('ffprobe')

let currentMergeProc: any
let mergeCanceled = false
const mergeScanProcs = new Set<any>()
const mergeTmpArtifacts: string[] = []
const mergeTmpDirs: string[] = []

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
      'csv=p=0',
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
  totalDurationSec?: number,
  progressBaseSec?: number,
  emitDone?: boolean
): Promise<void> => {
  const shouldEmitDone = emitDone !== false
  const durationSec =
    typeof totalDurationSec === 'number'
      ? totalDurationSec
      : inputPath
        ? await probeDurationSeconds(inputPath).catch(() => undefined)
        : undefined
  const baseSec = Number(progressBaseSec || 0)
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG_CMD, args)
    if (onSpawn) onSpawn(proc)

    proc.stderr.on('data', (data) => {
      const line = String(data)
      let progress: number | undefined
      const t = parseTimeFromLine(line)
      if (durationSec && t && t >= 0) {
        const pct = Math.min(99, ((baseSec + t) / durationSec) * 100)
        progress = Number(pct.toFixed(1))
      }
      const speed = line.match(/speed=\s*([\d.]+x)/)?.[1]
      const bitrate = line.match(/bitrate=\s*([\d.]+kbits\/s)/)?.[1]
      const payload: any = { status: 'progress', message: line }
      if (speed) payload.speed = speed
      if (bitrate) payload.bitrate = bitrate
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
        if (shouldEmitDone) event.sender.send(channel, { status: 'done', outputPath })
        resolve()
      } else {
        const msg = `ffmpeg exited with code ${code}`
        event.sender.send(channel, { status: 'error', message: msg })
        reject(new Error(msg))
      }
    })
  })
}

// 分组合并
const groupMerge: {
  isCanceled: boolean
  currentProc: ChildProcessWithoutNullStreams | null
  currentGroup: string
} = {
  isCanceled: false,
  currentProc: null,
  currentGroup: ''
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
    const { inputDir, outputDir, formats, noProgress } = (args || {}) as {
      inputDir: string
      outputDir: string
      formats: string[]
      noProgress?: boolean
    }
    const channel = 'videoMerge-status'

    const exts = Array.from(
      new Set(
        formats
          .map((s) =>
            String(s || '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
          .map((s) => (s.startsWith('.') ? s : `.${s}`))
      )
    )

    // 是否为视频文件
    const isVideoFile = (p: string): boolean => exts.includes(path.extname(p).toLowerCase())

    // 扫描文件
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

    // 获取视频信息
    const getMediaInfo = async (
      file: string
    ): Promise<{
      dur?: number
      vcodec?: string
      acodec?: string
      w?: number
      h?: number
      fps?: number
    }> => {
      return new Promise((resolve) => {
        const p = spawn(FFPROBE_CMD, [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'csv=p=0',
          file
        ])
        mergeScanProcs.add(p)
        let out = ''
        p.stdout.on('data', (d) => (out += String(d)))
        p.on('close', () => {
          mergeScanProcs.delete(p)
          const res: {
            dur?: number
            vcodec?: string
            acodec?: string
            w?: number
            h?: number
            fps?: number
          } = {}
          const d = parseFloat(out.trim())
          if (Number.isFinite(d)) res.dur = d
          resolve(res)
        })
      })
    }

    // 格式化时间
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
    // 发送开始事件
    const channelStart = (total?: number): void =>
      event.sender.send(channel, { status: 'start', total, phase: 'merge' })

    // 发送错误事件
    const channelError = (message: string): void =>
      event.sender.send(channel, { status: 'error', message })

    try {
      mergeCanceled = false
      if (!inputDir || !outputDir) {
        channelError('参数不完整')
        return
      }
      // 检查输入文件夹是否存在
      const inStat = await fs.promises.stat(inputDir).catch(() => null as any)
      // 检查输出文件夹是否存在
      const outStat = await fs.promises.stat(outputDir).catch(() => null as any)
      if (!inStat || !inStat.isDirectory()) {
        channelError('输入文件夹不存在')
        return
      }
      // 检查输出文件夹是否存在，不存在则创建
      if (!outStat || !outStat.isDirectory()) {
        await fs.promises.mkdir(outputDir, { recursive: true }).catch(() => null)
      }
      // 扫描输入文件夹下的视频文件
      const files = await scanRecursive(inputDir)
      if (files.length === 0) {
        channelError('未找到视频文件')
        return
      }
      if (!noProgress) {
        event.sender.send(channel, {
          status: 'progress',
          phase: 'scan',
          progress: 0,
          scanCount: 0,
          scanTotal: files.length
        })
      }

      if (noProgress) {
        const ts = fmtNow()
        const outPath = path.join(outputDir, `merged_${ts}.mkv`)
        const logPath = path.join(outputDir, `merged_${ts}.log`)
        const logStream = fs.createWriteStream(logPath, { flags: 'a' })
        logStream.write(`输入文件夹: ${inputDir}\n`)
        logStream.write(`输出文件: ${outPath}\n`)
        logStream.write(`共 ${files.length} 个文件\n`)
        for (const f of files) {
          logStream.write(`${f}\n`)
        }

        event.sender.send(channel, {
          status: 'start',
          total: files.length,
          phase: 'merge',
          noProgress: true
        })
        event.sender.send(channel, {
          status: 'progress',
          message: `输出文件：${outPath}`,
          noProgress: true
        })
        event.sender.send(channel, {
          status: 'progress',
          message: `合并文件数：${files.length}`,
          noProgress: true
        })

        const listPath = path.join(outputDir, 'list.txt')
        const listContent = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
        await fs.promises.unlink(listPath).catch(() => null)
        await fs.promises.writeFile(listPath, listContent).catch(() => null)

        const finalArgs: string[] = [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listPath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outPath
        ]

        const proc = spawn(FFMPEG_CMD, finalArgs)
        currentMergeProc = proc
        proc.stderr.on('data', (d: any) => {
          logStream.write(String(d))
          event.sender.send(channel, { status: 'progress', message: String(d), noProgress: true })
        })
        proc.on('error', (err) => {
          event.sender.send(channel, { status: 'error', message: String(err) })
        })
        proc.on('close', async (code) => {
          await fs.promises.unlink(listPath).catch(() => null)
          logStream.end()
          if (proc.killed) {
            event.sender.send(channel, { status: 'canceled' })
            return
          }
          if (code === 0 && fs.existsSync(outPath)) {
            event.sender.send(channel, { status: 'done', outputPath: outPath })
          } else {
            event.sender.send(channel, {
              status: 'error',
              message: `ffmpeg exited with code ${code}`
            })
          }
        })
        return
      }

      // 并行获取视频信息
      const metas: Array<{
        file: string
        ctime: number
        dur: number
        props: { vcodec?: string; acodec?: string; w?: number; h?: number; fps?: number }
        size: number
      }> = []

      let scanned = 0
      // cpu 核心数
      const cores = os.cpus()?.length || 4
      // 并发数 8-32
      let CONC = Math.min(32, Math.max(8, cores * 2))
      {
        // 截取前 64 个文件进行平均大小判断
        const sample = files.slice(0, Math.min(64, files.length))
        const stats = await Promise.all(
          sample.map((f) => fs.promises.stat(f).catch(() => null as any))
        )
        const sizes = stats.filter((s: any) => s && s.isFile()).map((s: any) => s.size)
        const avg = sizes.length
          ? sizes.reduce((a: number, b: number) => a + b, 0) / sizes.length
          : 0
        if (avg >= 500 * 1024 * 1024) CONC = Math.max(4, Math.min(cores, 8))
        else if (avg >= 100 * 1024 * 1024) CONC = Math.min(cores * 2, 16)
        else CONC = Math.min(cores * 3, 24)
      }
      let idx = 0
      const worker = async (): Promise<void> => {
        while (idx < files.length && !mergeCanceled) {
          const i = idx++
          const f = files[i]
          try {
            const [info, st] = await Promise.all([getMediaInfo(f), fs.promises.stat(f)])
            const dur = info.dur || 0
            if (!Number.isFinite(dur) || dur <= 0) {
              scanned += 1
              const sp = files.length
                ? Math.max(0, Math.min(100, (scanned / files.length) * 100))
                : 100
              event.sender.send(channel, {
                status: 'progress',
                phase: 'scan',
                progress: sp,
                scanCount: scanned,
                scanTotal: files.length
              })
              continue
            }
            const ctime = st.birthtimeMs || st.ctimeMs || Date.now()
            metas.push({
              file: f,
              ctime,
              dur,
              props: {
                vcodec: info.vcodec,
                acodec: info.acodec,
                w: info.w,
                h: info.h,
                fps: info.fps
              },
              size: st.size
            })
          } catch {}
          scanned += 1
          const sp = files.length ? Math.max(0, Math.min(100, (scanned / files.length) * 100)) : 100
          event.sender.send(channel, {
            status: 'progress',
            phase: 'scan',
            progress: sp,
            scanCount: scanned,
            scanTotal: files.length
          })
        }
      }

      await Promise.all(Array.from({ length: CONC }).map(() => worker()))
      if (mergeCanceled) {
        return
      }
      event.sender.send(channel, {
        status: 'progress',
        phase: 'scan',
        progress: 100,
        scanCount: scanned,
        scanTotal: files.length
      })

      if (metas.length === 0) {
        channelError('没有有效的视频文件')
        return
      }

      channelStart(metas.length)

      metas.sort((a, b) => a.ctime - b.ctime)

      const totalDuration = metas.reduce((s, x) => s + (Number(x.dur) || 0), 0)

      const ts = fmtNow()
      const outPath = path.join(outputDir, `merged_${ts}.mkv`)
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
        const tryDirectConcat = async (): Promise<boolean> => {
          const listPath = path.join(outputDir, 'list.txt')
          const listContent = metas.map((m) => `file '${m.file.replace(/'/g, "'\\''")}'`).join('\n')
          await fs.promises.unlink(listPath).catch(() => null)
          await fs.promises.writeFile(listPath, listContent).catch(() => null)
          const finalArgs: string[] = [
            '-y',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            listPath,
            '-c',
            'copy',
            '-movflags',
            '+faststart'
          ]
          try {
            await runFfmpeg(
              event,
              channel,
              [...finalArgs, outPath],
              outPath,
              undefined,
              (p) => {
                currentMergeProc = p
                p.stderr.on('data', (d: any) => {
                  logStream.write(String(d))
                })
              },
              totalDuration,
              0
            )
            await fs.promises.unlink(listPath).catch(() => null)
            return true
          } catch {
            await fs.promises.unlink(listPath).catch(() => null)
            return false
          }
        }

        const ok = await tryDirectConcat()
        if (!ok) {
          channelError('合并失败：仅拼接模式不支持参数不一致的视频')
          logStream.end()
          return
        }
      }

      logStream.end()
      if (!mergeCanceled) event.sender.send(channel, { status: 'done', outputPath: outPath })
    } catch (e) {
      const msg = String(e || '未知错误')
      event.sender.send('videoMerge-status', { status: 'error', message: msg })
    }
  })

  ipcMain.handle('videoMerge-cancel', async () => {
    mergeCanceled = true
    if (currentMergeProc) {
      try {
        currentMergeProc.kill('SIGINT')
      } finally {
        currentMergeProc = null
      }
    }
    for (const p of Array.from(mergeScanProcs)) {
      try {
        p.kill('SIGINT')
      } catch {}
      mergeScanProcs.delete(p)
    }
    for (const fp of mergeTmpArtifacts.splice(0)) {
      try {
        await fs.promises.unlink(fp)
      } catch {}
    }
    for (const dir of mergeTmpDirs.splice(0)) {
      try {
        await fs.promises.rmdir(dir)
      } catch {}
    }
    for (const bw of BrowserWindow.getAllWindows()) {
      try {
        bw.webContents.send('videoMerge-status', { status: 'canceled' })
      } catch {}
    }
  })

  ipcMain.handle('videoGroup-scan', async (_event, args) => {
    const { inputDir, formats } = (args || {}) as { inputDir: string; formats: string[] }
    const exts = Array.from(
      new Set(
        (formats || [])
          .map((s) =>
            String(s || '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
          .map((s) => (s.startsWith('.') ? s : `.${s}`))
      )
    )
    const isVideoFile = (p: string): boolean => exts.includes(path.extname(p).toLowerCase())
    const scanRecursive = async (dir: string): Promise<{ url: string; createTime: number }[]> => {
      const res: { url: string; createTime: number }[] = []
      const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const e of entries) {
        const fp = path.join(dir, e.name)
        if (e.isDirectory()) {
          res.push(...(await scanRecursive(fp)))
        } else if (e.isFile() && isVideoFile(fp)) {
          const stat = await fs.promises.stat(fp).catch(() => null as any)
          if (!stat || !stat.isFile()) continue
          res.push({ url: fp, createTime: stat.birthtimeMs })
        }
      }
      return res
    }
    const stat = await fs.promises.stat(inputDir).catch(() => null as any)
    if (!stat || !stat.isDirectory()) return { files: [] }
    const files = await scanRecursive(inputDir)
    return { files }
  })

  // 合并视频
  ipcMain.handle('videoGroup-merge', async (event, args: GroupMergeOptions) => {
    const { outputDir, group } = args
    const merge = (listPath: string, outPath: string) => {
      return new Promise((resolve, reject) => {
        const proc = spawn(FFMPEG_CMD, [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listPath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outPath
        ])

        groupMerge.currentProc = proc
        proc.on('close', (code) => {
          if (code === 0) resolve(true)
          else reject(new Error(`合并失败：退出码 ${code}`))
        })
        proc.stderr.on('data', () => {})
      })
    }
    groupMerge.isCanceled = false
    for (const g of group) {
      if (groupMerge.isCanceled) break
      const { name, files } = g
      const outPath = path.join(outputDir, `${name}.mkv`)
      // 创建临时列表文件
      const listPath = path.join(outputDir, `${name}-list.txt`)
      const listContent = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
      await fs.promises.unlink(listPath).catch(() => null)
      await fs.promises.writeFile(listPath, listContent).catch(() => null)
      try {
        event.sender.send('videoGroup-status', { status: 'merging', groupName: name })
        groupMerge.currentGroup = name
        await merge(listPath, outPath)
        event.sender.send('videoGroup-status', { status: 'done', groupName: name })
      } catch (e) {
        event.sender.send('videoGroup-status', {
          status: 'error',
          groupName: name,
          message: String(e || '未知错误')
        })
      } finally {
        await fs.promises.unlink(listPath).catch(() => null)
      }
    }
  })

  // 取消分组合并
  ipcMain.handle('videoGroup-cancel', async (event) => {
    groupMerge.isCanceled = true
    if (groupMerge.currentProc) {
      try {
        groupMerge.currentProc.kill('SIGINT')
        event.sender.send('videoGroup-status', {
          status: 'canceled',
          groupName: groupMerge.currentGroup
        })
      } finally {
        groupMerge.currentProc = null
      }
    }
  })
}
