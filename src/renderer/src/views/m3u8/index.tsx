import GoHome from '@/components/common/goHome'
import { PlayCircle, X, FolderOpen, Download, Trash2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
                status: status === 'start' ? 'downloading' : (status as TaskStatus),
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
      className="w-full overflow-x-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mx-auto max-w-3xl px-3 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <PlayCircle className="size-6 text-teal-600 dark:text-teal-400" />
            m3u8下载
          </h2>
          <GoHome />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>批量输入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="每行格式：m3u8url----文件名（可省略）"
              className="w-full h-32 resize-y rounded-md border border-input bg-background p-2 text-sm"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">最大并发</span>
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  max={10}
                  value={concurrency}
                  onChange={(e) =>
                    setConcurrency(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">重试次数</span>
                <Input
                  className="w-20"
                  type="number"
                  min={0}
                  max={5}
                  value={retry}
                  onChange={(e) => setRetry(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
                />
              </div>
            </div>
            <div className="flex flex-col  gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={chooseDir}>
                  <FolderOpen className="size-4" />
                  选择文件夹
                </Button>
                <span className="text-xs text-muted-foreground">{outDir || '未选择'}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                可用空间：{fmtBytes(disk.free)} / 总空间：{fmtBytes(disk.total)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={startAll}>
                <Download className="size-4" />
                加入队列并开始
              </Button>
              <Button variant="outline" onClick={clearTasks}>
                <Trash2 className="size-4" />
                清空队列
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>下载任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无任务</div>
            ) : (
              <div className="space-y-3">
                {tasks.map((t) => (
                  <div key={t.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{t.filename}</span>
                        <span className="text-xs text-muted-foreground">{t.status}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => cancelTask(t.id)}
                          aria-label="取消"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={t.progress || 0} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>进度：{(t.progress || 0).toFixed(1)}%</span>
                      <span>
                        速度：{t.speed || '-'}，码率：{t.bitrate || '-'}
                      </span>
                    </div>
                    {t.error && <div className="text-destructive text-xs">错误：{t.error}</div>}
                    <Separator />
                    <div className="text-xs break-all text-muted-foreground">{t.url}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
export default M3u8
