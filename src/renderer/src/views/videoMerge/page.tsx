import GoHome from '@/components/common/goHome'
import { motion } from 'framer-motion'
import { Video, FolderOpen, Play, X, FileText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

const VideoMergePage = () => {
  const [inputDir, setInputDir] = useState<string>('')
  const [outputDir, setOutputDir] = useState<string>(
    () => localStorage.getItem('merge.outDir') || ''
  )
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [scanProgress, setScanProgress] = useState<number | undefined>(undefined)
  const [scanCount, setScanCount] = useState<number>(0)
  const [scanTotal, setScanTotal] = useState<number>(0)
  const [running, setRunning] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [total, setTotal] = useState<number>(0)
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('merge.formats')
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length) return arr
      }
    } catch {}
    return ['mp4']
  })
  const [noProgress, setNoProgress] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('merge.noProgress')
      if (saved) return saved === '1'
    } catch {}
    return false
  })
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

  useEffect(() => {
    try {
      localStorage.setItem('merge.formats', JSON.stringify(selectedFormats))
    } catch {}
  }, [selectedFormats])

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')
  const canRun = useMemo(
    () => !!inputDir && !!outputDir && selectedFormats.length > 0 && !running,
    [inputDir, outputDir, selectedFormats.length, running]
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
      localStorage.setItem('merge.outDir', r.path)
      const ds = await window.api.getDiskSpace(r.path)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    }
  }

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
    await window.ffmpeg.mergeVideos({ inputDir, outputDir, formats: selectedFormats, noProgress })
  }

  const onCancel = async (): Promise<void> => {
    await window.ffmpeg.cancelVideoMerge()
  }

  return (
    <motion.div
      className="w-full overflow-x-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mx-auto max-w-3xl px-3 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Video className="size-6 text-cyan-600 dark:text-cyan-400" />
            视频合并
          </h2>
          <GoHome />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={chooseInputDir}>
                  <FolderOpen className="size-4" />
                  选择输入文件夹
                </Button>
                <span className="text-xs text-muted-foreground break-all">
                  {inputDir || '未选择'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={chooseOutputDir}>
                  <FolderOpen className="size-4" />
                  选择输出文件夹
                </Button>
                <span className="text-xs text-muted-foreground break-all">
                  {outputDir || '未选择'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                可用空间：{fmtBytes(disk.free)} / 总空间：{fmtBytes(disk.total)}
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={noProgress}
                  onCheckedChange={(checked) => {
                    const v = checked === true
                    setNoProgress(v)
                    try {
                      localStorage.setItem('merge.noProgress', v ? '1' : '0')
                    } catch {}
                  }}
                />
                <span>不显示进度（不扫描，更快）</span>
              </label>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">视频检索格式</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    'mp4',
                    'm4v',
                    'mov',
                    'avi',
                    'mkv',
                    'webm',
                    'ts',
                    'mts',
                    'm2ts',
                    'flv',
                    'wmv'
                  ].map((fmt) => (
                    <label key={fmt} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={selectedFormats.includes(fmt)}
                        onCheckedChange={(checked) => {
                          setSelectedFormats((prev) => {
                            if (checked === true) return Array.from(new Set([...prev, fmt]))
                            return prev.filter((x) => x !== fmt)
                          })
                        }}
                      />
                      <span>{fmt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onStart} disabled={!canRun}>
                <Play className="size-4" />
                开始合并
              </Button>
              <Button variant="outline" onClick={onCancel} disabled={!running}>
                <X className="size-4" />
                取消
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{status || '等待中'}</span>
                {!hideProgressRun && typeof progress === 'number' && (
                  <span className="text-xs text-muted-foreground">{progress.toFixed(1)}%</span>
                )}
              </div>
              {!hideProgressRun && typeof scanProgress === 'number' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      扫描文件数：{scanCount}/{scanTotal}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {scanProgress.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={scanProgress} />
                </div>
              )}
              <div className="text-xs text-muted-foreground">合并视频数：{total || 0}</div>
              {!hideProgressRun && typeof progress === 'number' && <Progress value={progress} />}
              {hideProgressRun && infoLines.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">合并信息</div>
                  <div
                    ref={logRef}
                    className="h-40 overflow-y-auto rounded border p-2 text-[11px] text-muted-foreground break-all whitespace-pre-wrap leading-tight"
                  >
                    {infoLines.map((ln, i) => (
                      <div key={`${i}-${ln.slice(0, 8)}`}>{ln}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {outputPath && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground break-all">
                <FileText className="size-4" />
                输出文件：{outputPath}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
export default VideoMergePage
