import { Button } from '@/components/ui/button'
import { motion } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ChromeDesktopAudioConstraints, ChromeDesktopVideoConstraints } from '@/env'
import { mergeVideoAndAudioStreams } from '@/utils'
import { DesktopCapturerSource } from 'electron'
import {
  ScreenShare,
  FolderOutput,
  Settings2,
  Monitor,
  Mic,
  Video as VideoIcon,
  Circle,
  Square,
  Clock,
  Speaker
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/useStore'
import { cn } from '@/lib/utils'
import GoHome from '@/components/common/goHome'

const ScreenRecord = () => {
  const [outDir, setOutDir] = useStorage<string>('screenRecord.outDir', '')
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
    }
  }
  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')
  useEffect(() => {
    if (!outDir) return
    ;(async () => {
      const ds = await window.api.getDiskSpace(outDir)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    })()
  }, [outDir])
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
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScreenShare className="size-6 text-primary" />
            屏幕录制
          </h1>
          <p className="text-sm text-muted-foreground mt-1">录制屏幕、系统音频及麦克风声音</p>
        </div>
        <GoHome />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="size-4" />
                录制设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Output Directory */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-normal">存储位置</label>
                <div
                  className={cn(
                    'relative group cursor-pointer rounded-lg border border-dashed p-3 transition-colors hover:bg-accent/50',
                    !outDir && 'bg-accent/20'
                  )}
                  onClick={chooseDir}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border shadow-sm group-hover:scale-105 transition-transform">
                      <FolderOutput className="size-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">输出文件夹</p>
                      <p className="text-xs text-muted-foreground truncate" title={outDir}>
                        {outDir || '点击选择...'}
                      </p>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
                    可用: {fmtBytes(disk.free)}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Video Source */}
              <div className="space-y-3">
                <label className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                  <Monitor className="size-3" />
                  视频源
                </label>
                <Select value={mediaId} onValueChange={setMediaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择屏幕或窗口" />
                  </SelectTrigger>
                  <SelectContent>
                    {mediaList.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-sm">
                        <span className="truncate block max-w-[200px]" title={f.name}>
                          {f.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Audio Source */}
              <div className="space-y-3">
                <label className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                  <Mic className="size-3" />
                  麦克风
                </label>
                <Select value={audioDeviceId} onValueChange={setAudioDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择麦克风设备" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDeviceList.map((f) => (
                      <SelectItem key={f.deviceId} value={f.deviceId} className="text-sm">
                        <span className="truncate block max-w-[200px]" title={f.label}>
                          {f.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frame Rate */}
              <div className="space-y-3">
                <label className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                  <VideoIcon className="size-3" />
                  帧率设置
                </label>
                <Select value={frameRate.toString()} onValueChange={(v) => setFrameRate(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择帧率" />
                  </SelectTrigger>
                  <SelectContent>
                    {[30, 60, 90, 120].map((f) => (
                      <SelectItem key={f} value={f.toString()}>
                        {f} FPS
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Toggles */}
              <div className="space-y-4">
                {isWindows && (
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm font-normal flex items-center gap-2 cursor-pointer"
                      htmlFor="sys-audio"
                    >
                      <Speaker className="size-4 text-muted-foreground" />
                      录制系统音频
                    </label>
                    <Switch
                      id="sys-audio"
                      checked={isSystemAudio}
                      onCheckedChange={setIsSystemAudio}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-normal flex items-center gap-2 cursor-pointer"
                    htmlFor="mic-audio"
                  >
                    <Mic className="size-4 text-muted-foreground" />
                    录制麦克风
                  </label>
                  <Switch id="mic-audio" checked={isMacAudio} onCheckedChange={setIsMacAudio} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview & Control */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <VideoIcon className="size-4" />
                实时预览
              </CardTitle>
              {isRecording && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80 animate-pulse gap-1">
                  <Circle className="size-2 fill-current" />
                  REC {sec}s
                </span>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0 relative bg-black/90 flex items-center justify-center min-h-[400px]">
              {!mediaId ? (
                <div className="text-muted-foreground flex flex-col items-center gap-3">
                  <ScreenShare className="size-12 opacity-50" />
                  <p>请在左侧选择视频源开始预览</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </CardContent>

            {/* Control Bar */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-center justify-center gap-4">
                {!isRecording ? (
                  <Button
                    size="lg"
                    className="w-40 gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
                    onClick={start}
                    disabled={!mediaId || !outDir}
                  >
                    <Circle className="size-4 fill-current" />
                    开始录制
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="w-40 gap-2 shadow-lg shadow-red-900/20"
                    onClick={stop}
                  >
                    <Square className="size-4 fill-current" />
                    停止录制
                  </Button>
                )}

                {isRecording && (
                  <div className="absolute right-6 flex items-center gap-2 text-sm font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-md">
                    <Clock className="size-4" />
                    <span>
                      {Math.floor(sec / 60)
                        .toString()
                        .padStart(2, '0')}
                      :{(sec % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
export default ScreenRecord
