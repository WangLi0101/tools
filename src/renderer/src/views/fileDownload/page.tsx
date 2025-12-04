import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FolderOpen,
  Download,
  Trash2,
  Play,
  FileVideo,
  HardDrive,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  X,
  ListVideo,
  Settings2,
  Activity,
  Pause
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/useStore'
import GoHome from '@/components/common/goHome'
import { motion, AnimatePresence } from 'motion/react'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'

interface DownloadTask {
  id: string
  url: string
  fileName: string
  status: 'pending' | 'queued' | 'downloading' | 'completed' | 'error' | 'paused'
  progress: number
  totalBytes: number
  receivedBytes: number
  speed: number
  error?: string
}

const getStatusConfig = (status: DownloadTask['status']) => {
  switch (status) {
    case 'completed':
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
    case 'paused':
      return {
        color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        icon: Pause,
        label: '已暂停'
      }
    case 'error':
      return {
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        icon: AlertCircle,
        label: '错误'
      }
    case 'pending':
    case 'queued':
      return {
        color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        icon: Clock,
        label: '排队中'
      }
    default:
      return {
        color: 'text-muted-foreground bg-muted border-border',
        icon: Clock,
        label: '等待'
      }
  }
}

const FileDownloadPage = () => {
  const [outDir, setOutDir] = useStorage<string>('videoDownload.outDir', '')
  const [concurrency, setConcurrency] = useStorage<number>('videoDownload.concurrency', 3)
  const [inputText, setInputText] = useState('')
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })

  const hasFileExtension = (name: string) => /\.[^./\\]+$/.test(name)

  const extractExtensionFromUrl = (link: string) => {
    const fromPath = (path: string) => {
      const filename = path.split('/').pop() ?? ''
      const match = filename.match(/(\.[A-Za-z0-9]{1,8})$/)
      return match ? match[1] : ''
    }

    try {
      const url = new URL(link)
      const ext = fromPath(url.pathname)
      if (ext) return ext
    } catch {
      // ignore
    }

    const sanitized = link.split(/[?#]/)[0]
    return fromPath(sanitized)
  }

  const attachExtensionIfMissing = (name: string, link: string) => {
    if (hasFileExtension(name)) return name
    const ext = extractExtensionFromUrl(link)
    return ext ? `${name}${ext}` : name
  }

  // Choose directory
  const chooseDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setOutDir(r.path)
    }
  }

  // Get disk space
  useEffect(() => {
    if (!outDir) return
    ;(async () => {
      const ds = await window.api.getDiskSpace(outDir)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    })()
  }, [outDir])

  const startDownload = useCallback(
    async (task: DownloadTask) => {
      if (!outDir) {
        toast.error('请先选择保存目录')
        return
      }

      // Optimistically set to downloading to prevent double start in effect loop
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'downloading', error: undefined } : t))
      )

      const filePath = `${outDir}/${task.fileName}`

      const res = await window.download.startDownload(
        task.url,
        filePath,
        task.id,
        task.receivedBytes || 0
      )
      if (!res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'error', error: res.error } : t))
        )
        toast.error(`任务启动失败: ${res.error}`)
      }
    },
    [outDir]
  )

  // Task queue manager
  useEffect(() => {
    if (!outDir) return

    const active = tasks.filter((t) => t.status === 'downloading').length
    const pending = tasks.filter((t) => t.status === 'queued')

    if (active < concurrency && pending.length > 0) {
      const toStart = pending.slice(0, concurrency - active)
      toStart.forEach((task) => {
        startDownload(task)
      })
    }
  }, [tasks, concurrency, outDir, startDownload])

  const parseInput = () => {
    const lines = inputText.split('\n').filter((l) => l.trim())
    const newTasks: DownloadTask[] = []
    lines.forEach((line) => {
      const parts = line.split('----')
      if (parts.length === 2) {
        const url = parts[0].trim()
        const fileName = parts[1].trim()
        if (url && fileName) {
          const normalizedFileName = attachExtensionIfMissing(fileName, url)
          newTasks.push({
            id: Math.random().toString(36).substr(2, 9),
            url,
            fileName: normalizedFileName,
            status: 'pending',
            progress: 0,
            totalBytes: 0,
            receivedBytes: 0,
            speed: 0
          })
        }
      }
    })
    if (newTasks.length === 0) {
      toast.error('格式错误，请使用: URL----文件名')
      return
    }
    setTasks((prev) => [...prev, ...newTasks])
    setInputText('')
    toast.success(`已添加 ${newTasks.length} 个任务`)
  }

  const queueAll = () => {
    if (!outDir) {
      toast.error('请先选择保存目录')
      return
    }

    const pendingTasks = tasks.filter(
      (t) => t.status === 'pending' || t.status === 'error' || t.status === 'paused'
    )
    if (pendingTasks.length === 0 && tasks.length > 0 && inputText.trim()) {
      parseInput()
      return
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'pending' || t.status === 'error' || t.status === 'paused'
          ? { ...t, status: 'queued', error: undefined }
          : t
      )
    )
  }

  const pauseIfDownloading = useCallback(async (task: DownloadTask) => {
    if (task.status !== 'downloading') return true
    const res = await window.download.pauseDownload(task.id)
    if (!res.success) {
      toast.error(`暂停失败: ${res.error}`)
      return false
    }
    return true
  }, [])

  const clearTasks = async () => {
    if (tasks.length === 0) return
    const activeTasks = tasks.filter((t) => t.status === 'downloading')
    const results = await Promise.all(activeTasks.map((task) => pauseIfDownloading(task)))
    if (results.includes(false)) {
      toast.error('部分任务暂停失败，请稍后重试')
      return
    }
    setTasks([])
    toast.success('任务已清空')
  }

  const deleteTask = async (task: DownloadTask) => {
    const ok = await pauseIfDownloading(task)
    if (!ok) return
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    toast.info('任务已删除')
  }

  const pauseTask = async (task: DownloadTask) => {
    if (task.status !== 'downloading') return
    const res = await window.download.pauseDownload(task.id)
    if (!res.success) {
      toast.error(`暂停失败: ${res.error}`)
      return
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'paused', speed: 0 } : t))
    )
    toast.info('任务已暂停')
  }

  const resumeTask = (task: DownloadTask) => {
    if (!outDir) {
      toast.error('请先选择保存目录')
      return
    }
    if (task.status !== 'paused') return
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'queued', error: undefined } : t))
    )
  }

  useEffect(() => {
    const removeProgress = window.download.onProgress((data) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.id
            ? {
                ...t,
                progress: data.progress,
                receivedBytes: data.receivedBytes,
                totalBytes: data.totalBytes,
                speed: data.speed
              }
            : t
        )
      )
    })

    const removeComplete = window.download.onComplete((data) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === data.id ? { ...t, status: 'completed', progress: 100 } : t))
      )
      toast.success('下载完成')
    })

    const removeError = window.download.onError((data) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === data.id ? { ...t, status: 'error', error: data.error } : t))
      )
      toast.error(`下载出错: ${data.error}`)
    })

    const removePaused = window.download.onPaused((data) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.id
            ? {
                ...t,
                status: 'paused',
                receivedBytes: data.receivedBytes,
                totalBytes: data.totalBytes,
                progress: data.totalBytes
                  ? (data.receivedBytes / data.totalBytes) * 100
                  : t.progress,
                speed: 0
              }
            : t
        )
      )
    })

    return () => {
      removeProgress()
      removeComplete()
      removeError()
      removePaused()
    }
  }, [])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')

  // Stats calculations
  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    downloading: tasks.filter((t) => t.status === 'downloading').length,
    speed: tasks.reduce(
      (acc, curr) => acc + (curr.status === 'downloading' ? curr.speed || 0 : 0),
      0
    )
  }

  return (
    <motion.div
      className="w-full overflow-x-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="space-y-6 container mx-auto  max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Download className="size-6 text-primary" />
              文件批量下载
            </h2>
            <p className="text-sm text-muted-foreground mt-1">支持批量下载直链文件</p>
          </div>
          <GoHome />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/30 border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ListVideo className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总任务</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Loader2 className="size-5 text-blue-500 animate-spin" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">下载中</p>
                <p className="text-2xl font-bold text-blue-500">{stats.downloading}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Activity className="size-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总速度</p>
                <p className="text-2xl font-bold text-orange-500">
                  {stats.speed ? `${formatBytes(stats.speed)}/s` : '-'}
                </p>
              </div>
            </CardContent>
          </Card>
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
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="每行格式：URL----文件名&#10;例如：https://example.com/v.mp4----v.mp4"
                    className="w-full h-40 resize-none rounded-md border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      已输入 {inputText.split('\n').filter((l) => l.trim()).length} 个任务
                    </p>
                    <Button variant="secondary" size="sm" onClick={parseInput}>
                      解析任务
                    </Button>
                  </div>
                </div>

                <Separator />

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
                    onClick={queueAll}
                    className="w-full gap-2"
                    disabled={!outDir || tasks.length === 0}
                  >
                    <Play className="size-4" />
                    全部开始
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
                    onClick={() => void clearTasks()}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4 mr-2" />
                    清空列表
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 pt-6 min-h-[500px] max-h-[calc(100vh-200px)] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {tasks.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-12"
                    >
                      <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center">
                        <ListVideo className="size-8 opacity-50" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="font-medium">暂无任务</p>
                        <p className="text-xs">在左侧输入链接并点击解析</p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {tasks.map((t) => {
                        const statusConfig = getStatusConfig(t.status)
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.div
                            key={t.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
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
                                    <h4 className="font-medium text-sm truncate" title={t.fileName}>
                                      {t.fileName}
                                    </h4>
                                    <div
                                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${statusConfig.color}`}
                                    >
                                      <StatusIcon
                                        className={`size-3 shrink-0 ${statusConfig.spin ? 'animate-spin' : ''}`}
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

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {t.status === 'downloading' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => pauseTask(t)}
                                      title="暂停"
                                    >
                                      <Pause className="size-4" />
                                    </Button>
                                  )}
                                  {t.status === 'paused' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => resumeTask(t)}
                                      title="继续"
                                    >
                                      <Play className="size-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => void deleteTask(t)}
                                    title="删除"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              </div>

                              {(t.status === 'downloading' ||
                                t.status === 'completed' ||
                                t.status === 'paused') && (
                                <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                                  <div className="flex flex-col">
                                    <span className="opacity-70">进度</span>
                                    <span className="font-medium text-foreground">
                                      {(t.progress || 0).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="opacity-70">大小</span>
                                    <span className="font-medium text-foreground">
                                      {formatBytes(t.receivedBytes)}
                                      {t.totalBytes ? ` / ${formatBytes(t.totalBytes)}` : ''}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="opacity-70">速度</span>
                                    <span className="font-medium text-foreground">
                                      {t.speed ? `${formatBytes(t.speed)}/s` : '-'}
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
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default FileDownloadPage
