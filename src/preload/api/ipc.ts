import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'fs'
import { spawnSync } from 'child_process'
export const registerIpc = () => {
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
  ipcMain.handle('select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths?.[0]) return { canceled: true }
    return { canceled: false, path: filePaths[0] }
  })
  ipcMain.handle('get-disk-space', async (_event, dir) => {
    try {
      const res = spawnSync('df', ['-k', dir])
      const out = String(res.stdout || '')
      const lines = out.trim().split('\n')
      const last = lines[lines.length - 1]
      const cols = last.trim().split(/\s+/)
      const totalBytes = Number(cols[1]) * 1024
      const freeBytes = Number(cols[3]) * 1024
      if (Number.isFinite(totalBytes) && Number.isFinite(freeBytes))
        return { totalBytes, freeBytes }
    } catch {}
    return { totalBytes: 0, freeBytes: 0 }
  })
}
