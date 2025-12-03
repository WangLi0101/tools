import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import https from 'https'
import http from 'http'
import path from 'path'

export const registerDownloadIPC = (): void => {
  ipcMain.handle('download-file', async (event, { url, filePath, id }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'Window not found' }

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const file = fs.createWriteStream(filePath)
      const protocol = url.startsWith('https') ? https : http

      const request = protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close()
          fs.unlink(filePath, () => {}) // Delete the file async
          win.webContents.send('download-error', {
            id,
            error: `Status Code: ${response.statusCode}`
          })
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        let receivedBytes = 0
        let lastUpdate = Date.now()
        let lastBytes = 0
        let speed = 0

        response.pipe(file)

        response.on('data', (chunk) => {
          receivedBytes += chunk.length
          const now = Date.now()
          if (now - lastUpdate > 500 || receivedBytes === totalBytes) {
            const timeDiff = (now - lastUpdate) / 1000
            const bytesDiff = receivedBytes - lastBytes
            speed = timeDiff > 0 ? bytesDiff / timeDiff : 0
            const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0

            win.webContents.send('download-progress', {
              id,
              progress,
              receivedBytes,
              totalBytes,
              speed
            })

            lastUpdate = now
            lastBytes = receivedBytes
          }
        })

        file.on('finish', () => {
          file.close()
          win.webContents.send('download-complete', { id, filePath })
        })
      })

      request.on('error', (err) => {
        fs.unlink(filePath, () => {})
        win.webContents.send('download-error', { id, error: err.message })
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
