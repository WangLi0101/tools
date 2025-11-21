import { useEffect, useMemo, useRef, useState } from 'react'
import Uploader from '@/components/common/uploader'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Download, Video, Upload, Settings2, Zap, Loader2, X, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'

type VideoFormat = 'mp4' | 'webm' | 'mov' | 'mkv'

const FORMATS: VideoFormat[] = ['mp4', 'webm', 'mov', 'mkv']
const VIDEO_BITRATES: string[] = ['800k', '1M', '2M', '4M', '8M']
const AUDIO_BITRATES: string[] = ['96k', '128k', '160k', '192k', '256k', '320k']

const VideoPage = (): React.JSX.Element => {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<VideoFormat>('mp4')
  const [width, setWidth] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [videoBitrate, setVideoBitrate] = useState<string>('2M')
  const [audioBitrate, setAudioBitrate] = useState<string>('192k')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const unsubscribeRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = window.ffmpeg.onConvertVideoStatus((payload) => {
      if (payload.status === 'start') {
        setRunning(true)
        setStatus('开始转换...')
        setProgress(0)
      } else if (payload.status === 'progress') {
        setStatus(payload.message ?? '')
        setProgress((p) => (typeof payload.progress === 'number' ? payload.progress : p))
      } else if (payload.status === 'done') {
        setRunning(false)
        setStatus('转换完成')
        setProgress(100)
        if (payload.outputPath) setOutputPath(payload.outputPath)
        toast.success(`转换完成：${payload.outputPath ?? ''}`)
      } else if (payload.status === 'canceled') {
        setRunning(false)
        setStatus('已取消')
        setProgress(undefined)
        toast.info('已取消')
      } else if (payload.status === 'error') {
        setRunning(false)
        setStatus(payload.message ?? '转换失败')
        setProgress(undefined)
        toast.error(`转换失败：${payload.message ?? ''}`)
      }
    })
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [])

  const canConvert = useMemo(() => {
    return !!file && !running
  }, [file, running])

  const inputPath = useMemo(() => {
    const f = file as File | null
    return f?.path
  }, [file])

  const onConvert = async (): Promise<void> => {
    if (!file || !inputPath) {
      setStatus('请先选择视频文件')
      return
    }
    setOutputPath('')
    await window.ffmpeg.convertVideo({
      inputPath,
      outputFormat: format,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined,
      videoBitrate,
      audioBitrate
    })
  }

  const onSaveAs = async (): Promise<void> => {
    if (!outputPath) return
    const ext = (outputPath.split('.').pop() || format).toLowerCase()
    const filters = [{ name: ext.toUpperCase(), extensions: [ext] }]
    const res = await window.api.saveAs(outputPath, { defaultPath: outputPath, filters })
    if (res.saved) setStatus(`已另存为：${res.destPath}`)
  }

  const onCancel = async (): Promise<void> => {
    if (!running) return
    await window.ffmpeg.cancelVideo()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Panel: Controls */}
      <div className="lg:col-span-4 space-y-6">
        {/* Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Upload className="size-4" />
            <span>文件上传</span>
          </div>
          <Uploader
            onSelect={setFile}
            accept="video/*"
            label="拖拽视频到此处，或点击选择文件"
            showPreview={false}
          />
        </div>

        <Separator />

        {/* Settings Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Settings2 className="size-4" />
            <span>转换参数</span>
          </div>

          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">目标格式</label>
                <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="选择格式" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">视频码率</label>
                <Select value={videoBitrate} onValueChange={(v) => setVideoBitrate(v)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="选择视频码率" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_BITRATES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">音频码率</label>
                <Select value={audioBitrate} onValueChange={(v) => setAudioBitrate(v)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="选择音频码率" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIO_BITRATES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">宽度</label>
                  <Input
                    type="number"
                    placeholder="自动"
                    value={width}
                    onChange={(e) => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">高度</label>
                  <Input
                    type="number"
                    placeholder="自动"
                    value={height}
                    onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status & Progress */}
          <AnimatePresence>
            {(running || typeof progress === 'number') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{status}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <Button
              onClick={onConvert}
              disabled={!canConvert}
              className="w-full h-11 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Zap className="mr-2 size-4" />
                  开始转换
                </>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onCancel}
                disabled={!running}
                variant="outline"
                className="w-full border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="mr-2 size-4" />
                取消
              </Button>
              <Button
                onClick={onSaveAs}
                disabled={!outputPath || running}
                variant="secondary"
                className="w-full"
              >
                <Download className="mr-2 size-4" />
                另存为
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="lg:col-span-8">
        <div className="space-y-3 h-full flex flex-col">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Video className="size-4" />
            <span>效果预览</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* Source Video */}
            <div className="relative group rounded-xl border bg-muted/30 overflow-hidden min-h-[300px] flex flex-col">
              <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur border shadow-sm text-xs font-medium">
                原视频
              </div>
              <div className="flex-1 flex items-center justify-center p-4">
                {file ? (
                  <video
                    controls
                    src={`file://${file.path}`}
                    className="w-full h-auto rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                    <Video className="size-12" />
                    <span className="text-sm">等待上传</span>
                  </div>
                )}
              </div>
            </div>

            {/* Result Video */}
            <div className="relative group rounded-xl border bg-muted/30 overflow-hidden min-h-[300px] flex flex-col">
              <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary backdrop-blur shadow-sm text-xs font-medium">
                结果
              </div>
              {outputPath && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-600 text-xs font-medium">
                    完成
                  </span>
                </div>
              )}
              <div className="flex-1 flex items-center justify-center p-4">
                {outputPath ? (
                  <video
                    controls
                    src={encodeURI(`file://${outputPath}`)}
                    className="w-full h-auto rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                    <ArrowRight className="size-12 opacity-20" />
                    <span className="text-sm">等待转换</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPage
