import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function generatePDF(url: string) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  })
  try {
    const ses = win.webContents.session
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {}
      headers['Access-Control-Allow-Origin'] = ['*']
      headers['Access-Control-Allow-Headers'] = ['*']
      headers['Access-Control-Allow-Methods'] = ['GET,POST,PUT,PATCH,DELETE,OPTIONS']
      callback({ responseHeaders: headers })
    })
    await win.loadURL(url)
    await sleep(1000) // 等待页面加载完成
    await win.webContents.executeJavaScript(
      'new Promise((resolve) => { if (document.readyState === "complete") { resolve(); } else { window.addEventListener("load", () => resolve(), { once: true }); } })'
    )
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4'
    })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const urlHost = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${urlHost}_${timestamp}.pdf`
    const outputDir = app.getPath('downloads')
    const outputPath = path.join(outputDir, filename)
    await fs.promises.writeFile(outputPath, pdfBuffer)
    return outputPath
  } finally {
    win.destroy()
  }
}
export const registerPlaywrightIPC = () => {
  ipcMain.handle('export-pdf', (_event, url: string) => {
    return generatePDF(url)
  })
}
