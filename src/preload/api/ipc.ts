import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
export const registerIpc = () => {
  const send = (payload: any) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('update-status', payload))
  }
  ipcMain.handle('save-as', async (_event, args) => {
    const { sourcePath, defaultPath, filters } = (args || {}) as {
      sourcePath: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters
    })
    if (canceled || !filePath) return { saved: false }
    await fs.promises.copyFile(sourcePath, filePath)
    return { saved: true, destPath: filePath }
  })
  ipcMain.on('quit', () => {
    app.exit()
  })
  ipcMain.on('minimize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      window.minimize()
    }
  })
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      send({ status: 'update-not-available' })
      return
    }
    send({ status: 'checking' })
    try {
      autoUpdater.autoDownload = false
      autoUpdater.checkForUpdates()
    } catch (e: any) {
      send({ status: 'error', message: String(e?.message || e) })
    }
  })
  ipcMain.handle('download-update', async () => {
    if (!app.isPackaged) return
    try {
      await autoUpdater.downloadUpdate()
    } catch (e: any) {
      send({ status: 'error', message: String(e?.message || e) })
    }
  })
  ipcMain.on('quit-and-install', () => {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
  })
  autoUpdater.on('update-available', (info) => {
    send({ status: 'update-available', info })
  })
  autoUpdater.on('update-not-available', () => {
    send({ status: 'update-not-available' })
  })
  autoUpdater.on('download-progress', (p) => {
    send({
      status: 'download-progress',
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    send({ status: 'update-downloaded', info })
  })
  autoUpdater.on('error', (e) => {
    send({ status: 'error', message: String((e as any)?.message || e) })
  })
  ipcMain.handle('select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths?.[0]) return { canceled: true }
    return { canceled: false, path: filePaths[0] }
  })
  ipcMain.handle('get-disk-space', async (_event, dir) => {
    try {
      if (process.platform === 'win32') {
        const root = path.win32.parse(dir || '').root || process.env.SystemDrive || 'C\\'
        const drive = root.slice(0, 2)
        const ps = spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${drive}'") | Select-Object Size,FreeSpace | ConvertTo-Json -Compress`
          ],
          { encoding: 'utf8' }
        )
        const text = (ps.stdout || '').trim()
        if (text) {
          const obj = JSON.parse(text)
          const totalBytes = Number(obj.Size) || 0
          const freeBytes = Number(obj.FreeSpace) || 0
          if (Number.isFinite(totalBytes) && Number.isFinite(freeBytes))
            return { totalBytes, freeBytes }
        }
        const fsutil = spawnSync('fsutil', ['volume', 'diskfree', drive], { encoding: 'utf8' })
        const out = (fsutil.stdout || '').toString()
        const nums = out.match(/\d+/g)
        if (nums && nums.length >= 2) {
          const freeBytes = Number(nums[0])
          const totalBytes = Number(nums[1])
          if (Number.isFinite(totalBytes) && Number.isFinite(freeBytes))
            return { totalBytes, freeBytes }
        }
      } else {
        const res = spawnSync('df', ['-k', dir], { encoding: 'utf8' })
        const out = (res.stdout || '').trim()
        const lines = out.split('\n')
        const last = lines[lines.length - 1]
        const cols = last.trim().split(/\s+/)
        const totalBytes = Number(cols[1]) * 1024
        const freeBytes = Number(cols[3]) * 1024
        if (Number.isFinite(totalBytes) && Number.isFinite(freeBytes))
          return { totalBytes, freeBytes }
      }
    } catch {}
    return { totalBytes: 0, freeBytes: 0 }
  })
}
