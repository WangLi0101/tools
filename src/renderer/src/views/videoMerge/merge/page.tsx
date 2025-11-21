import {
  Play,
  X,
  FolderInput,
  FolderOutput,
  Settings2,
  Activity,
  Timer,
  CheckCircle2,
  FileVideo
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/useStore'
import { cn } from '@/lib/utils'

const Merge = () => {
  const [inputDir, setInputDir] = useState<string>('')
  const [outputDir, setOutputDir] = useStorage<string>('merge.outDir', '')
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [scanProgress, setScanProgress] = useState<number | undefined>(undefined)
  const [scanCount, setScanCount] = useState<number>(0)
  const [scanTotal, setScanTotal] = useState<number>(0)
  const [running, setRunning] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [total, setTotal] = useState<number>(0)
  const defaultSelectedFormat = (() => {
    try {
      const raw = localStorage.getItem('merge.format') ?? localStorage.getItem('merge.formats')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length) return String(parsed[0])
          if (typeof parsed === 'string' && parsed) return parsed
        } catch {
          if (raw) return raw
        }
      }
    } catch {}
    return 'mp4'
  })()
  const [selectedFormat, setSelectedFormat] = useStorage<string>(
    'merge.format',
    defaultSelectedFormat
  )
  const [noProgress, setNoProgress] = useStorage<boolean>('merge.noProgress', false)
  const [hideProgressRun, setHideProgressRun] = useState<boolean>(false)
  const [infoLines, setInfoLines] = useState<string[]>([])

  const unsubRef = useRef<(() => void) | null>(null)
  const hideRef = useRef<boolean>(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = window.ffmpeg.onVideoMergeStatus((payload) => {
      const { status: st, progress: p, message, outputPath: out, phase } = payload
      if (st === 'start') {
        setRunning(true)
        setStatus('开始合并')
        const hp = payload.noProgress === true
        setHideProgressRun(hp)
        hideRef.current = hp
        setProgress(hp ? undefined : 0)
        setScanProgress(undefined)
        setScanCount(0)
        setScanTotal(0)
        setOutputPath('')
        setInfoLines([])
        if (typeof payload.total === 'number') setTotal(payload.total)
      } else if (st === 'progress') {
        setRunning(true)
        if (phase === 'scan') {
          if (!hideRef.current && typeof p === 'number') setScanProgress(p)
          if (typeof payload.scanCount === 'number') setScanCount(payload.scanCount)
          if (typeof payload.scanTotal === 'number') setScanTotal(payload.scanTotal)
          setStatus('扫描中')
        } else {
          if (!hideRef.current && typeof p === 'number') setProgress(p)
          setStatus('合并中')
          if (hideRef.current && typeof message === 'string') {
            const parts = message
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
            if (parts.length) {
              setInfoLines((prev) => {
                const next = [...prev, ...parts]
                return next.slice(Math.max(0, next.length - 20))
              })
            }
          }
        }
      } else if (st === 'done') {
        setRunning(false)
        setProgress(undefined)
        setScanProgress(undefined)
        setStatus('合并完成')
        setOutputPath(out || '')
        setTotal((t) => t)
        setHideProgressRun(false)
        hideRef.current = false
        toast.success('合并完成')
      } else if (st === 'error') {
        setRunning(false)
        setProgress(undefined)
        setScanProgress(undefined)
        setStatus(`错误：${message || ''}`)
        setHideProgressRun(false)
        hideRef.current = false
        toast.error(`合并失败：${message || ''}`)
      } else if (st === 'canceled') {
        setRunning(false)
        setProgress(undefined)
        setScanProgress(undefined)
        setStatus('已取消')
        setHideProgressRun(false)
        hideRef.current = false
      }
    })
    unsubRef.current = unsubscribe
    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [])

  useEffect(() => {
    if (hideRef.current) {
      const el = logRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [infoLines])

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')
  const canRun = useMemo(
    () => !!inputDir && !!outputDir && !!selectedFormat && !running,
    [inputDir, outputDir, selectedFormat, running]
  )

  const chooseInputDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setInputDir(r.path)
    }
  }
  const chooseOutputDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setOutputDir(r.path)
    }
  }
  useEffect(() => {
    if (!outputDir) return
    ;(async () => {
      const ds = await window.api.getDiskSpace(outputDir)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    })()
  }, [outputDir])
  const onStart = async (): Promise<void> => {
    if (!inputDir) {
      toast.error('请选择输入文件夹')
      return
    }
    if (!outputDir) {
      toast.error('请选择输出文件夹')
      return
    }
    setRunning(true)
    setStatus('准备合并')
    setOutputPath('')
    await window.ffmpeg.mergeVideos({ inputDir, outputDir, formats: [selectedFormat], noProgress })
  }

  const onCancel = async (): Promise<void> => {
    await window.ffmpeg.cancelVideoMerge()
  }

  const formats = ['mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'ts', 'mts', 'm2ts', 'flv', 'wmv']

  return (
    <div className="w-full p-2 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Settings Column */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="size-4" />
                合并选项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Input/Output Section in Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={cn(
                    'relative group cursor-pointer rounded-lg border border-dashed p-4 transition-colors hover:bg-accent/50',
                    !inputDir && 'bg-accent/20'
                  )}
                  onClick={chooseInputDir}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border shadow-sm group-hover:scale-105 transition-transform">
                      <FolderInput className="size-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">源文件夹</p>
                      <p className="text-xs text-muted-foreground truncate" title={inputDir}>
                        {inputDir || '点击选择...'}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    'relative group cursor-pointer rounded-lg border border-dashed p-4 transition-colors hover:bg-accent/50',
                    !outputDir && 'bg-accent/20'
                  )}
                  onClick={chooseOutputDir}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-full border shadow-sm group-hover:scale-105 transition-transform">
                      <FolderOutput className="size-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">输出位置</p>
                      <p className="text-xs text-muted-foreground truncate" title={outputDir}>
                        {outputDir || '点击选择...'}
                      </p>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
                    可用: {fmtBytes(disk.free)}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileVideo className="size-4" />
                  目标格式
                </label>
                <RadioGroup
                  value={selectedFormat}
                  onValueChange={setSelectedFormat}
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2"
                >
                  {formats.map((fmt) => (
                    <label
                      key={fmt}
                      className={cn(
                        'cursor-pointer flex items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary',
                        selectedFormat === fmt &&
                          'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      )}
                    >
                      <RadioGroupItem value={fmt} id={`fmt-${fmt}`} className="sr-only" />
                      {fmt.toUpperCase()}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-progress"
                  checked={noProgress}
                  onCheckedChange={(c) => setNoProgress(c === true)}
                />
                <label
                  htmlFor="no-progress"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  极速模式 (不显示进度条，适合大量小文件)
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Column */}
        <div className="space-y-6">
          <Card className={cn('h-full shadow-sm flex flex-col', running && 'border-primary/50')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4" />
                任务状态
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">当前状态</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      running
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : status === '合并完成'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : status.includes('错误')
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {status || '就绪'}
                  </span>
                </div>

                {(running || status === '合并完成') && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>处理进度</span>
                      <span>{typeof progress === 'number' ? `${progress.toFixed(1)}%` : '--'}</span>
                    </div>
                    {!hideProgressRun && typeof progress === 'number' && (
                      <Progress value={progress} className="h-2" />
                    )}

                    {!hideProgressRun && typeof scanProgress === 'number' && (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>
                            扫描文件 ({scanCount}/{scanTotal})
                          </span>
                          <span>{scanProgress.toFixed(1)}%</span>
                        </div>
                        <Progress value={scanProgress} className="h-1.5 opacity-70" />
                      </>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Timer className="size-3" />
                      <span>总文件数: {total || 0}</span>
                    </div>
                  </div>
                )}

                {hideProgressRun && infoLines.length > 0 && (
                  <div
                    ref={logRef}
                    className="h-32 overflow-y-auto rounded-md border bg-slate-950 p-3 text-[10px] font-mono text-slate-50 shadow-inner"
                  >
                    {infoLines.map((ln, i) => (
                      <div key={i} className="truncate">
                        {ln}
                      </div>
                    ))}
                  </div>
                )}

                {outputPath && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-md">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-green-600 mt-0.5" />
                      <div className="space-y-1 overflow-hidden">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">
                          合并成功
                        </p>
                        <p className="text-[10px] text-green-600/80 dark:text-green-400/70 break-all leading-tight">
                          {outputPath}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={onStart}
                  disabled={!canRun}
                  className={cn('w-full', running && 'opacity-50')}
                  variant={running ? 'secondary' : 'default'}
                >
                  <Play className="size-4" />
                  {running ? '运行中' : '开始'}
                </Button>
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={!running}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="size-4" />
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
export default Merge
