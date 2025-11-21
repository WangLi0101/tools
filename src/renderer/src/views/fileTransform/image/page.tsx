import { useEffect, useMemo, useRef, useState } from 'react'
import Uploader from '@/components/common/uploader'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Settings2, Upload, Zap, Loader2, ImageIcon, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

type ImageFormat = 'jpg' | 'png' | 'webp' | 'gif'

const FORMATS: ImageFormat[] = ['jpg', 'png', 'webp', 'gif']

const ImagePage = (): React.JSX.Element => {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ImageFormat>('webp')
  const [quality, setQuality] = useState<number>(80)
  const [width, setWidth] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const unsubscribeRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = window.ffmpeg.onConvertImageStatus((payload) => {
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
      setStatus('请先选择图片文件')
      return
    }
    setOutputPath('')
    await window.ffmpeg.convertImage({
      inputPath,
      outputFormat: format,
      quality,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined
    })
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
          <Uploader onSelect={setFile} />
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
                <Select value={format} onValueChange={(v) => setFormat(v as ImageFormat)}>
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
                <label className="text-xs font-medium text-muted-foreground">
                  质量 ({quality})
                </label>
                <div className="h-10 flex items-center px-1">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(v) => setQuality(v[0])}
                    className="py-2"
                  />
                </div>
              </div>
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
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="lg:col-span-8">
        <div className="space-y-3 h-full flex flex-col">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ImageIcon className="size-4" />
            <span>效果预览</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* Source Image */}
            <div className="relative group rounded-xl border bg-muted/30 overflow-hidden min-h-[300px] flex flex-col">
              <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur border shadow-sm text-xs font-medium">
                原图
              </div>
              <div className="flex-1 flex items-center justify-center p-4">
                {file ? (
                  <img
                    src={URL.createObjectURL(file)}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    alt="Original"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                    <ImageIcon className="size-12" />
                    <span className="text-sm">等待上传</span>
                  </div>
                )}
              </div>
            </div>

            {/* Result Image */}
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
                  <img
                    src={encodeURI(`file://${outputPath}`)}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    alt="Result"
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

export default ImagePage
