import GoHome from '@/components/common/goHome'
import {
  PlayCircle,
  X,
  FolderOpen,
  Download,
  Trash2,
  FileVideo,
  Settings2,
  ListVideo,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  PauseCircle,
  StopCircle
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { useStorage } from '@/hooks/useStore'

type TaskStatus = 'queued' | 'waiting' | 'downloading' | 'paused' | 'done' | 'error' | 'canceled'
interface Task {
  id: string
  url: string
  filename: string
  status: TaskStatus
  progress: number
  speed?: string
  bitrate?: string
  attempt: number
  outputPath?: string
  error?: string
}

const isValidM3u8 = (s: string): boolean => /^(https?:\/\/).*(\.m3u8)(\?.*)?$/.test(s.trim())
const genName = (url: string, i: number): string => {
  const u = url.split('?')[0]
  const base = u.split('/').pop() || `video_${i}`
  return base.replace(/\.m3u8$/i, '')
}

const getStatusConfig = (status: TaskStatus) => {
  switch (status) {
    case 'done':
      return {
        color: 'text-green-500 bg-green-500/10 border-green-500/20',
        icon: CheckCircle2,
        label: '完成'
      }
    case 'downloading':
      return {
        color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        icon: Loader2,
        label: '下载中',
        spin: true
      }
    case 'error':
      return {
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        icon: AlertCircle,
        label: '错误'
      }
    case 'queued':
      return {
        color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        icon: Clock,
        label: '排队中'
      }
    case 'paused':
      return {
        color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        icon: PauseCircle,
        label: '暂停'
      }
    case 'canceled':
      return {
        color: 'text-muted-foreground bg-muted border-border',
        icon: StopCircle,
        label: '取消'
      }
    default:
      return {
        color: 'text-muted-foreground bg-muted border-border',
        icon: Clock,
        label: '等待'
      }
  }
}

const M3u8 = (): React.JSX.Element => {
  const [text, setText] = useState('')
  const [concurrency, setConcurrency] = useState<number>(3)
  const [retry, setRetry] = useState<number>(2)
  const [outDir, setOutDir] = useStorage<string>('m3u8.outDir', '')
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })
  const [tasks, setTasks] = useState<Task[]>([])
  const unsubRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = window.ffmpeg.onM3u8Status((p: any) => {
      const { taskId, status, progress, speed, bitrate, outputPath, message } = p

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status:
                  status === 'start' || status === 'progress'
                    ? 'downloading'
                    : (status as TaskStatus),
                progress: progress ?? t.progress,
                speed: speed ?? t.speed,
                bitrate: bitrate ?? t.bitrate,
                outputPath: outputPath ?? t.outputPath,
                error: status === 'error' ? String(message || '未知错误') : t.error
              }
            : t
        )
      )
    })

    unsubRef.current = unsubscribe
    console.log('M3u8Status listener registered successfully')

    return () => {
      console.log('Cleaning up M3u8Status listener...')
      unsubRef.current?.()
    }
  }, [])

  useEffect(() => {
    const active = tasks.filter((t) => t.status === 'downloading').length
    const pendings = tasks.filter((t) => t.status === 'queued')
    if (!outDir) return
    if (active >= concurrency) return
    const toStart = pendings.slice(0, Math.max(0, concurrency - active))
    toStart.forEach((t) => {
      if (disk.free && disk.free < 300 * 1024 * 1024) return
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'downloading' } : x)))
      window.ffmpeg.startM3u8({
        taskId: t.id,
        url: t.url,
        outputDir: outDir,
        filename: t.filename,
        format: 'mp4'
      })
    })
  }, [tasks, concurrency, outDir, disk.free])

  const parseLines = (): Task[] => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const res: Task[] = []
    lines.forEach((line, i) => {
      const [url, name] = line.split('----')
      if (!isValidM3u8(url || '')) {
        toast.error(`第${i + 1}行URL不合法`)
        return
      }
      const filename = (name && name.trim()) || genName(url, i)
      res.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        url,
        filename,
        status: 'queued',
        progress: 0,
        attempt: 0
      })
    })
    return res
  }

  const chooseDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setOutDir(r.path)
    }
  }

  const startAll = (): void => {
    if (!outDir) {
      toast.error('请先选择存储文件夹')
      return
    }
    const newTasks = parseLines()
    if (newTasks.length === 0) return
    setTasks((prev) => [...prev, ...newTasks])
  }

  const cancelTask = (id: string): void => {
    console.log(`[Renderer] Canceling task:`, id)
    window.ffmpeg.cancelM3u8(id)
    setTasks((prev) => prev.filter((x) => x.id !== id))
  }
  const clearTasks = (): void => {
    for (const t of tasks) {
      if (t.status === 'downloading') {
        window.ffmpeg.cancelM3u8(t.id)
      }
    }
    setTasks([])
  }
  useEffect(() => {
    if (!outDir) return
    ;(async () => {
      const ds = await window.api.getDiskSpace(outDir)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    })()
  }, [outDir])
  useEffect(() => {
    const errs = tasks.filter((t) => t.status === 'error')
    if (errs.length) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.status === 'error' && t.attempt < retry) {
            return { ...t, status: 'queued', attempt: t.attempt + 1, error: undefined }
          }
          return t
        })
      )
    }
  }, [tasks, retry])

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')

  return (
    <motion.div
      className="w-full overflow-x-hidden p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <PlayCircle className="size-6 text-primary" />
              M3U8 下载器
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              批量下载 M3U8 视频流并自动转换为 MP4 格式
            </p>
          </div>
          <GoHome />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Input & Settings */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="overflow-hidden transition-all hover:shadow-md">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileVideo className="size-5 text-primary" />
                  批量输入
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="每行格式：m3u8url----文件名（可省略）"
                    className="w-full h-40 resize-none rounded-md border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    已输入 {text.split('\n').filter((l) => l.trim()).length} 个链接
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Settings2 className="size-4" />
                      最大并发
                    </div>
                    <Input
                      className="w-20 h-8 text-right"
                      type="number"
                      min={1}
                      max={10}
                      value={concurrency}
                      onChange={(e) =>
                        setConcurrency(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="size-4" />
                      重试次数
                    </div>
                    <Input
                      className="w-20 h-8 text-right"
                      type="number"
                      min={0}
                      max={5}
                      value={retry}
                      onChange={(e) =>
                        setRetry(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FolderOpen className="size-4" />
                      输出目录
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground truncate min-h-10 flex items-center">
                        {outDir || '请选择保存路径...'}
                      </div>
                      <Button variant="outline" size="icon" onClick={chooseDir} title="选择文件夹">
                        <FolderOpen className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {outDir && (
                    <div className="rounded-md bg-muted/30 p-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <HardDrive className="size-4" />
                      <div className="flex-1 flex justify-between">
                        <span>
                          可用:{' '}
                          <span className="text-foreground font-medium">{fmtBytes(disk.free)}</span>
                        </span>
                        <span>总共: {fmtBytes(disk.total)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    onClick={startAll}
                    className="w-full gap-2"
                    disabled={!outDir || !text.trim()}
                  >
                    <Download className="size-4" />
                    加入队列并开始
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Task List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="h-full overflow-hidden transition-all hover:shadow-md flex flex-col">
              <CardHeader className="bg-muted/30 pb-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListVideo className="size-5 text-primary" />
                  任务列表
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({tasks.length})
                  </span>
                </CardTitle>
                {tasks.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTasks}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4 mr-2" />
                    清空列表
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 pt-6 min-h-[500px]">
                {tasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-12">
                    <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
                      <ListVideo className="size-8 opacity-50" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-medium">暂无任务</p>
                      <p className="text-xs">在左侧输入链接并点击开始</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((t) => {
                      const statusConfig = getStatusConfig(t.status)
                      const StatusIcon = statusConfig.icon

                      return (
                        <div
                          key={t.id}
                          className="group relative overflow-hidden rounded-lg border bg-card transition-all hover:shadow-sm hover:border-primary/50"
                        >
                          {t.status === 'downloading' && (
                            <div className="absolute bottom-0 left-0 h-1 bg-primary/10 w-full">
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${t.progress || 0}%` }}
                              />
                            </div>
                          )}

                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm truncate" title={t.filename}>
                                    {t.filename}
                                  </h4>
                                  <div
                                    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${statusConfig.color}`}
                                  >
                                    <StatusIcon
                                      className={`size-3 ${statusConfig.spin ? 'animate-spin' : ''}`}
                                    />
                                    <span>{statusConfig.label}</span>
                                  </div>
                                </div>
                                <div
                                  className="text-xs text-muted-foreground truncate"
                                  title={t.url}
                                >
                                  {t.url}
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => cancelTask(t.id)}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>

                            {t.status !== 'queued' && t.status !== 'waiting' && (
                              <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                                <div className="flex flex-col">
                                  <span className="opacity-70">进度</span>
                                  <span className="font-medium text-foreground">
                                    {(t.progress || 0).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="opacity-70">速度</span>
                                  <span className="font-medium text-foreground">
                                    {t.speed || '-'}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="opacity-70">码率</span>
                                  <span className="font-medium text-foreground">
                                    {t.bitrate || '-'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {t.error && (
                              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 p-2 rounded">
                                <AlertCircle className="size-3" />
                                {t.error}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
export default M3u8
