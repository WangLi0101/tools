import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'fs'
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
}
