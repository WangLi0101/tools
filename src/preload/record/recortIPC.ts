import { ipcMain } from 'electron'
import fs, { WriteStream } from 'fs'
import path from 'path'
export const registerRecordIPC = () => {
  let isStop = false
  let writeStream: WriteStream | null = null
  ipcMain.handle('record-start', (event, outDir: string) => {
    console.log('record-start', outDir)
    isStop = false
    const outPath = path.join(outDir, `${Date.now()}.webm`)
    writeStream = fs.createWriteStream(outPath)
  })
  ipcMain.handle('record-stop', () => {
    console.log('record-stop')
    isStop = true
  })
  ipcMain.handle('record-push-data', (event, data: ArrayBuffer) => {
    const readStream = Buffer.from(data)
    writeStream?.write(readStream)
    if (isStop) {
      writeStream?.end()
    }
  })
}
