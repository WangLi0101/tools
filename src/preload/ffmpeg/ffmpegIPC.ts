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
    const p = spawn('ffprobe', [
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
  onSpawn?: (p: any) => void
): Promise<void> => {
  const durationSec = inputPath ? await probeDurationSeconds(inputPath) : undefined
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

    const proc = spawn('ffmpeg', [...ffArgs, outputPath])
    m3u8Procs.set(taskId, proc)
    m3u8States.set(taskId, 'running')

    // Track progress even without duration
    let lastProgress = 0
    let lastTime = 0

    proc.stdout.on('data', (data) => {
      const text = String(data)
      console.log(`[M3U8 ${taskId}] stdout:`, text)
      const m = text.match(/out_time_ms=(\d+)/)
      if (m) {
        const v = Number(m[1])
        if (Number.isFinite(v) && v >= 0) {
          const t = v / 1000000

          if (durationSec && durationSec > 0) {
            // Normal progress calculation with duration
            const progress = Number(Math.min(99, (t / durationSec) * 100).toFixed(1))
            console.log(`[M3U8 ${taskId}] Sending progress:`, progress)
            event.sender.send('m3u8-status', { taskId, status: 'progress', progress })
          } else {
            // Fallback: estimate progress based on time elapsed
            // This is not perfect but gives user feedback
            if (t > lastTime) {
              lastTime = t
              // Gradually increase progress, but cap at 95% until completion
              const estimatedProgress = Math.min(95, lastProgress + 0.5)
              lastProgress = estimatedProgress
              console.log(`[M3U8 ${taskId}] Sending estimated progress:`, estimatedProgress)
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
      console.log(`[M3U8 ${taskId}] stderr:`, line)
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
      console.log(`[M3U8 ${taskId}] Process closed with code:`, code)

      // Clean up process state
      m3u8States.set(taskId, 'stopped')

      // Only remove from map if the process is actually dead
      if (proc.killed || code !== null) {
        m3u8Procs.delete(taskId)
      }

      if (proc.killed) {
        console.log(`[M3U8 ${taskId}] Process was killed`)
        event.sender.send('m3u8-status', { taskId, status: 'canceled' })
        return
      }
      if (code === 0 && fs.existsSync(outputPath)) {
        // Ensure progress shows 100% when completed
        console.log(`[M3U8 ${taskId}] Sending completion status...`)
        event.sender.send('m3u8-status', { taskId, status: 'progress', progress: 100 })
        event.sender.send('m3u8-status', { taskId, status: 'done', outputPath })
      } else {
        console.log(`[M3U8 ${taskId}] Sending error status...`)
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
    console.log(`[M3U8 ${taskId}] Cancel requested, process found:`, !!p, 'current state:', state)

    if (p && state !== 'stopped' && !p.killed) {
      try {
        console.log(`[M3U8 ${taskId}] Killing process...`)
        // Use SIGTERM first, then SIGKILL if needed
        p.kill('SIGTERM')
        m3u8States.set(taskId, 'stopped')

        // Give process time to terminate gracefully
        setTimeout(() => {
          if (!p.killed) {
            console.log(`[M3U8 ${taskId}] Force killing process...`)
            p.kill('SIGKILL')
          }
        }, 1000)

        console.log(`[M3U8 ${taskId}] Process termination initiated`)
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
}
