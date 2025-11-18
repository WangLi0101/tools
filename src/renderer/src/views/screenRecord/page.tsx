import GoHome from '@/components/common/goHome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DesktopCapturerSource } from 'electron'
import { FolderOpen, PlayCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const ScreenRecord = () => {
  const [outDir, setOutDir] = useState<string>(
    () => localStorage.getItem('screenRecord.outDir') || ''
  )
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })
  const [mediaList, setMediaList] = useState<DesktopCapturerSource[]>([])
  const [mediaId, setMediaId] = useState<string>('')
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [sec, setSec] = useState<number>(0)
  const mediaRecorderRef = useRef<MediaRecorder>(null)
  const chooseDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setOutDir(r.path)
      localStorage.setItem('screenRecord.outDir', r.path)
      const ds = await window.api.getDiskSpace(r.path)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    }
  }
  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')
  const getMediaResource = async () => {
    const source = await window.api.getMediaSource()
    setMediaList(source)
  }
  useEffect(() => {
    getMediaResource()
  }, [])
  const start = async () => {
    if (!mediaId) {
      toast.error('请选择屏幕')
      return
    }
    if (!outDir) {
      toast.error('请选择文件夹')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: mediaId
        }
      }
    })

    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: 'video/webm; codecs=vp9'
    })

    mediaRecorderRef.current.ondataavailable = async (e) => {
      const arrayBuffer = await e.data.arrayBuffer()
      window.record.pushData(arrayBuffer)
    }
    mediaRecorderRef.current.onstop = () => {
      console.log('onstop')
    }
    window.record.start(outDir)
    // 1分钟分片
    mediaRecorderRef.current.start(1 * 60 * 1000)
    setIsRecording(true)
  }
  const stop = async () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }
  useEffect(() => {
    let timer: number | null = null
    if (isRecording) {
      timer = window.setInterval(() => {
        setSec((s) => s + 1)
      }, 1000)
    } else {
      timer && clearInterval(timer)
      setSec(0)
    }
    return () => {
      timer && clearInterval(timer)
    }
  }, [isRecording])
  return (
    <div className="mx-auto  px-3 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <PlayCircle className="size-6 text-teal-600 dark:text-teal-400" />
          屏幕录制
        </h2>
        <GoHome />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>屏幕录制</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col  gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={chooseDir}>
                <FolderOpen className="size-4" />
                选择文件夹
              </Button>
              <span className="text-xs text-muted-foreground">{outDir || '未选择'}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              可用空间：{fmtBytes(disk.free)} / 总空间：{fmtBytes(disk.total)}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">媒体源</label>
              <Select value={mediaId} onValueChange={(v) => setMediaId(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择要录制的媒体源" />
                </SelectTrigger>
                <SelectContent>
                  {mediaList.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="operator flex items-center gap-2">
              <Button variant="default" size="sm" onClick={start} disabled={isRecording}>
                {isRecording ? `正在录制 ${sec} 秒` : '开始录制'}
              </Button>
              <Button variant="destructive" size="sm" onClick={stop} disabled={!isRecording}>
                停止录制
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default ScreenRecord
