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
import { Switch } from '@/components/ui/switch'
import { ChromeDesktopAudioConstraints, ChromeDesktopVideoConstraints } from '@/env'
import { mergeVideoAndAudioStreams } from '@/utils'
import { DesktopCapturerSource } from 'electron'
import { FolderOpen, PlayCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [frameRate, setFrameRate] = useState<number>(30)
  const [isSystemAudio, setIsSystemAudio] = useState<boolean>(false)
  const [isMacAudio, setIsMacAudio] = useState<boolean>(false)
  const [isWindows, setIsWindows] = useState<boolean>(false)
  const [audioDeviceList, setAudioDeviceList] = useState<MediaDeviceInfo[]>([])
  const [audioDeviceId, setAudioDeviceId] = useState<string>('')
  const videoStreamRef = useRef<MediaStream>(null)
  const audioStreamRef = useRef<MediaStream>(null)
  const mediaRecorderRef = useRef<MediaRecorder>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  // 选择文件夹
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
  // 获取媒体资源
  const getMediaResource = async () => {
    const source = await window.api.getMediaSource()
    setMediaList(source)
  }
  // 是否为mac系统
  const getIsMac = async () => {
    const res = await window.api.getSystemType()
    setIsWindows(res === 'win32')
  }
  // 获取音频设备
  const getAudioDevice = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioDevices = devices.filter((device) => device.kind === 'audioinput')
    setAudioDeviceList(audioDevices)
  }
  useEffect(() => {
    getIsMac()
    getMediaResource()
    getAudioDevice()
  }, [])

  // 开始
  const start = async () => {
    if (!mediaId) {
      toast.error('请选择屏幕')
      return
    }
    if (!outDir) {
      toast.error('请选择文件夹')
      return
    }
    if (isMacAudio && !audioDeviceId) {
      toast.error('请选择音频设备')
      return
    }
    if (!videoStreamRef.current) {
      await getVideoStream()
      if (!videoStreamRef.current) {
        toast.error(
          isWindows
            ? '获取屏幕流失败，请检查权限'
            : '系统未授予屏幕录制权限：系统设置 -> 隐私与安全 -> 屏幕录制，勾选本应用并重启后重试'
        )
        return
      }
    }
    let stream: MediaStream | null = null
    if (isMacAudio) {
      // 合并麦克风和系统声音流
      await getAudioStream()
      stream = mergeVideoAndAudioStreams(videoStreamRef.current!, audioStreamRef.current!)
    } else {
      stream = videoStreamRef.current
    }
    console.log('stream', stream)
    mediaRecorderRef.current = new MediaRecorder(stream!, {
      mimeType: 'video/webm; codecs=vp9,opus'
    })

    mediaRecorderRef.current.ondataavailable = async (e) => {
      console.log('ondataavailable', e.data)
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

  // 暂停
  const stop = async () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }
  // 录制时间
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

  // 获取视频流
  const getVideoStream = useCallback(async () => {
    try {
      const containers: MediaStreamConstraints = {
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: mediaId,
            maxFrameRate: frameRate
          }
        } as ChromeDesktopVideoConstraints
      }
      if (isSystemAudio) {
        containers.audio = {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: mediaId
          }
        } as ChromeDesktopAudioConstraints
      }
      const stream = await navigator.mediaDevices.getUserMedia(containers)
      videoStreamRef.current = stream
    } catch (e: any) {
      toast.error(
        isWindows
          ? `获取屏幕流失败：${e?.name || e}`
          : '系统未授予屏幕录制权限：系统设置 -> 隐私与安全 -> 屏幕录制，勾选本应用并重启后重试'
      )
      try {
        const fb = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate },
          audio: isSystemAudio ? true : false
        })
        videoStreamRef.current = fb
      } catch {}
    }
    if (!videoRef.current || !videoStreamRef.current) {
      return
    }
    videoRef.current.srcObject = videoStreamRef.current
    try {
      await videoRef.current.play()
    } catch {}
  }, [mediaId, frameRate, isSystemAudio, isWindows])

  // 获取音频流
  const getAudioStream = useCallback(async () => {
    const res = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: audioDeviceId }
    })
    audioStreamRef.current = res
  }, [audioDeviceId])

  useEffect(() => {
    if (mediaId) {
      getVideoStream()
    }
  }, [mediaId, frameRate, getVideoStream])

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
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">媒体设备</label>
              <Select value={mediaId} onValueChange={(v) => setMediaId(v)}>
                <SelectTrigger className="w-[250px]">
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">音频设备</label>
              <Select value={audioDeviceId} onValueChange={(v) => setAudioDeviceId(v)}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="选择要录制的音频设备" />
                </SelectTrigger>
                <SelectContent>
                  {audioDeviceList.map((f) => (
                    <SelectItem key={f.deviceId} value={f.deviceId}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isWindows && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">录制系统音频</label>
                <Switch checked={isSystemAudio} onCheckedChange={(v) => setIsSystemAudio(v)} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">录制Mic音频</label>
              <Switch checked={isMacAudio} onCheckedChange={(v) => setIsMacAudio(v)} />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">帧率</label>
              <Select value={frameRate.toString()} onValueChange={(v) => setFrameRate(Number(v))}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择要录制的帧率" />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 120].map((f) => (
                    <SelectItem key={f} value={f.toString()}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">预览</label>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-48 border border-border"
              />
            </div>
            <div className="operator flex flex-col gap-2">
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
