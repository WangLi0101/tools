import { useEffect, useMemo, useRef, useState } from 'react'
import Uploader from '@/components/common/uploader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Download, FileVideo, Settings2, Play, Loader2, XCircle, Save, Film } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'

type VideoFormat = 'mp4' | 'webm'

const FORMATS: VideoFormat[] = ['mp4', 'webm']
const AUDIO_BITRATES: string[] = ['96k', '128k', '160k', '192k', '256k', '320k']
const PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow'
] as const

const CompressVideoPage = (): React.JSX.Element => {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<VideoFormat>('mp4')
  const [crf, setCrf] = useState<number>(28)
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>('medium')
  const [width, setWidth] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [audioBitrate, setAudioBitrate] = useState<string>('128k')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const unsubscribeRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = window.ffmpeg.onCompressVideoStatus((payload) => {
      if (payload.status === 'start') {
        setRunning(true)
        setStatus('开始压缩...')
        setProgress(0)
      } else if (payload.status === 'progress') {
        setStatus(payload.message ?? '')
        setProgress((p) => (typeof payload.progress === 'number' ? payload.progress : p))
      } else if (payload.status === 'done') {
        setRunning(false)
        setStatus('压缩完成')
        setProgress(100)
        if (payload.outputPath) setOutputPath(payload.outputPath)
        toast.success(`压缩完成：${payload.outputPath ?? ''}`)
      } else if (payload.status === 'error') {
        setRunning(false)
        setStatus(payload.message ?? '压缩失败')
        setProgress(undefined)
        toast.error(`压缩失败：${payload.message ?? ''}`)
      }
    })
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [])

  const canRun = useMemo(() => {
    return !!file && !running
  }, [file, running])

  const inputPath = useMemo(() => {
    const f = file as File | null
    return f?.path
  }, [file])

  const onCompress = async (): Promise<void> => {
    if (!file || !inputPath) {
      setStatus('请先选择视频文件')
      return
    }
    setOutputPath('')
    await window.ffmpeg.compressVideo({
      inputPath,
      outputFormat: format,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined,
      crf,
      preset,
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
      <div className="space-y-6">
        <Card className="overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileVideo className="size-5 text-primary" />
              文件上传
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Uploader
              onSelect={setFile}
              accept="video/*"
              label="拖拽视频到此处，或点击选择文件"
              showPreview={false}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="size-5 text-primary" />
              压缩设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">目标格式</label>
                <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
                  <SelectTrigger className="w-full">
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
                <label className="text-sm font-medium text-muted-foreground">CRF (质量)</label>
                <Input
                  type="number"
                  min={0}
                  max={51}
                  value={crf}
                  onChange={(e) => setCrf(Number(e.target.value))}
                  placeholder="数值越小质量越高 (0-51)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">预设 (Preset)</label>
                <Select
                  value={preset}
                  onValueChange={(v) => setPreset(v as (typeof PRESETS)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择预设" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">音频码率</label>
                <Select value={audioBitrate} onValueChange={setAudioBitrate}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择码率" />
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">宽度 (Width)</label>
                <Input
                  type="number"
                  placeholder="自动"
                  value={width}
                  onChange={(e) => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">高度 (Height)</label>
                <Input
                  type="number"
                  placeholder="自动"
                  value={height}
                  onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <Button onClick={onCompress} disabled={!canRun} className="w-full gap-2" size="lg">
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> 处理中...
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> 开始压缩
                  </>
                )}
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={onCancel} disabled={!running} variant="destructive" className="w-full gap-2">
                  <XCircle className="size-4" /> 取消
                </Button>
                <Button
                  onClick={onSaveAs}
                  disabled={!outputPath || running}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Save className="size-4" /> 另存为
                </Button>
              </div>
            </div>

            {typeof progress === 'number' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>处理进度</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            
            <div className="min-h-6 text-xs text-center text-muted-foreground wrap-break-word">
              {status}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="h-full overflow-hidden transition-all hover:shadow-md flex flex-col">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Film className="size-5 text-primary" />
              压缩前后预览
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6 grid gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <div className="size-2 rounded-full bg-blue-500" />
                原文件
              </div>
              {file ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <video controls src={`file://${file.path}`} className="w-full" />
                  <div className="mt-2 text-xs text-muted-foreground text-center truncate">
                    {file.name}
                  </div>
                </div>
              ) : (
                <div className="h-32 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <FileVideo className="size-8 opacity-50" />
                  <span className="text-sm">暂无文件</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <div className="size-2 rounded-full bg-green-500" />
                处理结果
              </div>
              {outputPath ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <video controls src={`file://${outputPath}`} className="w-full" />
                  <div className="mt-2 text-xs text-muted-foreground text-center truncate">
                    {outputPath.split(/[/\\]/).pop()}
                  </div>
                </div>
              ) : (
                <div className="h-32 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Download className="size-8 opacity-50" />
                  <span className="text-sm">等待处理</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CompressVideoPage
