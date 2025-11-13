import { useEffect, useMemo, useRef, useState } from 'react'
import Uploader from '@/components/common/uploader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Download } from 'lucide-react'
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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>文件上传</CardTitle>
        </CardHeader>
        <CardContent>
          <Uploader
            onSelect={setFile}
            accept="video/*"
            label="拖拽视频到此处，或点击选择文件"
            showPreview={false}
          />
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
                <label className="text-sm text-muted-foreground">视频码率</label>
                <Select value={videoBitrate} onValueChange={(v) => setVideoBitrate(v)}>
                  <SelectTrigger className="w-full">
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
                <label className="text-sm text-muted-foreground">音频比特率</label>
                <Select value={audioBitrate} onValueChange={(v) => setAudioBitrate(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择音频比特率" />
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
            </div>

            <Separator />
            <Button onClick={onConvert} disabled={!canConvert} className="w-full">
              {running ? '处理中...' : '开始转换'}
            </Button>
            <Button
              onClick={onSaveAs}
              disabled={!outputPath || running}
              variant="secondary"
              className="w-full"
            >
              <Download className="size-4" /> 另存为
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
              <div className="text-sm text-muted-foreground">原视频</div>
              {file ? (
                <video controls src={`file://${file.path}`} className="w-full" />
              ) : (
                <div className="h-40 rounded-md border flex items-center justify-center text-sm text-muted-foreground">
                  无文件
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">结果</div>
              {outputPath ? (
                <video controls src={encodeURI(`file://${outputPath}`)} className="w-full" />
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

export default VideoPage
