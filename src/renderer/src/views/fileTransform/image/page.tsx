import { useEffect, useMemo, useRef, useState } from 'react'
import Uploader from '@/components/common/uploader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      } else if (payload.status === 'error') {
        setRunning(false)
        setStatus(payload.message ?? '转换失败')
        setProgress(undefined)
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>文件上传</CardTitle>
        </CardHeader>
        <CardContent>
          <Uploader onSelect={setFile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>转换设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">目标格式</label>
                <Select value={format} onValueChange={(v) => setFormat(v as ImageFormat)}>
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
                <label className="text-sm text-muted-foreground">质量</label>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={(v) => setQuality(v[0])}
                />
                <div className="text-xs text-muted-foreground">{quality}</div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">宽度</label>
                <Input
                  type="number"
                  placeholder="自动"
                  value={width}
                  onChange={(e) => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">高度</label>
                <Input
                  type="number"
                  placeholder="自动"
                  value={height}
                  onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
            <Button onClick={onConvert} disabled={!canConvert} className="w-full">
              {running ? '处理中...' : '开始转换'}
            </Button>
            {typeof progress === 'number' ? (
              <div className="space-y-1">
                <Progress value={progress} />
                <div className="text-xs text-muted-foreground">{progress}%</div>
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground min-h-6 break-words">{status}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>转换前后预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">原图</div>
              {file ? (
                <img src={URL.createObjectURL(file)} className="w-full h-auto rounded-md" />
              ) : (
                <div className="h-40 rounded-md border flex items-center justify-center text-sm text-muted-foreground">
                  无文件
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">结果</div>
              {outputPath ? (
                <img src={encodeURI(`file://${outputPath}`)} className="w-full h-auto rounded-md" />
              ) : (
                <div className="h-40 rounded-md border flex items-center justify-center text-sm text-muted-foreground">
                  暂无结果
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ImagePage
