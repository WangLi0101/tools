import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import https from 'https'
import http from 'http'
import path from 'path'

type ClientRequest = http.ClientRequest

// 活动下载任务的元信息，保存请求、文件流以及当前进度
interface ActiveDownload {
  request?: ClientRequest
  fileStream?: fs.WriteStream
  filePath: string
  url: string
  receivedBytes: number
  totalBytes: number
  isPaused: boolean
  win: BrowserWindow
}

// 以任务 ID 为 key 存储所有进行中的下载
const activeDownloads = new Map<string, ActiveDownload>()

/**
 * 清理下载任务
 * @param id 任务ID
 * @param removeFile 是否删除文件
 */
const cleanupTask = (id: string, removeFile = false) => {
  const task = activeDownloads.get(id)
  if (!task) return
  // 移除监听事件
  task.request?.removeAllListeners()
  // 销毁请求
  task.request?.destroy()
  // 关闭文件流
  task.fileStream?.close()
  // 删除文件
  if (removeFile) {
    fs.unlink(task.filePath, () => {})
  }
  // 从活动下载中删除
  activeDownloads.delete(id)
}

/**
 * 解析总字节数
 * @param response 响应
 * @param initialBytes 初始字节数
 */
const parseTotalBytes = (response: http.IncomingMessage, initialBytes: number) => {
  const rangeHeader = response.headers['content-range']
  // 如果有Range头，说明支持断点续传
  if (rangeHeader) {
    // 获取Range头的值
    const headerValue = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader
    const match = /\/(\d+)$/.exec(headerValue || '')
    if (match) {
      // 获取总字节数
      return parseInt(match[1], 10)
    }
  }
  // 如果没有Range头，说明不支持断点续传
  const length = parseInt(response.headers['content-length'] || '0', 10)
  // 如果有初始字节数，说明是断点续传
  return length > 0 ? length + initialBytes : 0
}

export const registerDownloadIPC = (): void => {
  // 处理渲染进程发起的下载请求
  ipcMain.handle('download-file', async (event, { url, filePath, id, resumeBytes = 0 }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'Window not found' }

    try {
      // 清楚下载任务
      cleanupTask(id)
      // 创建目录
      const dir = path.dirname(filePath)

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // 设置下载起点
      let startBytes = typeof resumeBytes === 'number' ? resumeBytes : 0
      if (startBytes > 0) {
        try {
          const stat = fs.statSync(filePath)
          startBytes = stat.isFile() ? stat.size : 0
        } catch {
          startBytes = 0
        }
      }

      // 根据协议选择 http/https，并准备请求头
      const protocol = url.startsWith('https') ? https : http
      const headers: Record<string, string> = {}
      // 设置Range头
      if (startBytes > 0) {
        headers['Range'] = `bytes=${startBytes}-`
      }

      // 建立任务初始状态并缓存，方便后续暂停/恢复
      const downloadState: ActiveDownload = {
        filePath,
        url,
        receivedBytes: startBytes,
        totalBytes: 0,
        isPaused: false,
        win
      }
      activeDownloads.set(id, downloadState)

      const request = protocol.request(url, { headers }, (response) => {
        const status = response.statusCode || 0
        // 如果状态码不是200或206，说明下载失败
        if (![200, 206].includes(status)) {
          cleanupTask(id, false)
          win.webContents.send('download-error', {
            id,
            error: `Status Code: ${status}`
          })
          response.resume()
          return
        }
        let initialBytes = startBytes
        if (status !== 206) {
          initialBytes = 0
        }

        // 解析总字节数
        const totalBytes = parseTotalBytes(response, initialBytes)
        // 如果不支持断点续传，清空文件
        if (initialBytes === 0 && startBytes > 0) {
          try {
            fs.truncateSync(filePath, 0)
          } catch {
            // ignore
          }
        }
        // 创建文件流 flags: initialBytes > 0 ? 'a' : 'w' 表示如果文件存在，从文件末尾开始写入
        const fileStream = fs.createWriteStream(filePath, { flags: initialBytes > 0 ? 'a' : 'w' })

        downloadState.fileStream = fileStream
        downloadState.receivedBytes = initialBytes
        downloadState.totalBytes = totalBytes
        // 如果有初始字节数，说明是断点续传，发送进度
        if (initialBytes > 0) {
          const progress = totalBytes > 0 ? (initialBytes / totalBytes) * 100 : 0
          win.webContents.send('download-progress', {
            id,
            progress,
            receivedBytes: initialBytes,
            totalBytes,
            speed: 0
          })
        }

        let lastUpdate = Date.now()
        let lastBytes = initialBytes
        // 管道
        response.pipe(fileStream)

        // 数据流入时累加字节，并定期回传进度
        response.on('data', (chunk) => {
          downloadState.receivedBytes += chunk.length
          const now = Date.now()
          const shouldEmit = now - lastUpdate > 500 || downloadState.receivedBytes === totalBytes
          if (!shouldEmit) return

          const timeDiff = (now - lastUpdate) / 1000
          const bytesDiff = downloadState.receivedBytes - lastBytes
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0
          const progress = totalBytes > 0 ? (downloadState.receivedBytes / totalBytes) * 100 : 0

          win.webContents.send('download-progress', {
            id,
            progress,
            receivedBytes: downloadState.receivedBytes,
            totalBytes,
            speed
          })

          lastUpdate = now
          lastBytes = downloadState.receivedBytes
        })
        // 文件写入完成
        // 文件写入完成，通知渲染进程成功
        fileStream.on('finish', () => {
          if (downloadState.isPaused) return
          fileStream.close()
          activeDownloads.delete(id)
          win.webContents.send('download-complete', { id, filePath })
        })
        // 文件写入错误
        fileStream.on('error', (err) => {
          if (downloadState.isPaused) return
          cleanupTask(id, false)
          win.webContents.send('download-error', { id, error: err.message })
        })
      })

      downloadState.request = request

      // 请求层面错误（如断网、DNS 失败）
      request.on('error', (err) => {
        if (downloadState.isPaused) return
        cleanupTask(id, true)
        win.webContents.send('download-error', { id, error: err.message })
      })

      request.end()

      return { success: true }
    } catch (error: any) {
      cleanupTask(id, false)
      return { success: false, error: error.message }
    }
  })

  // 处理渲染进程的暂停指令：保留已写入的文件
  ipcMain.handle('download-pause', async (_event, { id }) => {
    const task = activeDownloads.get(id)
    if (!task) return { success: false, error: 'Download not found' }

    task.isPaused = true
    cleanupTask(id, false) // 保留已有文件
    task.win.webContents.send('download-paused', {
      id,
      receivedBytes: task.receivedBytes,
      totalBytes: task.totalBytes
    })
    return { success: true }
  })
}
