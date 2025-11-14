import GoHome from '@/components/common/goHome'
import { motion } from 'framer-motion'
import { Video, FolderOpen, Play, X, FileText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

const VideoMergePage = () => {
  const [inputDir, setInputDir] = useState<string>('')
  const [outputDir, setOutputDir] = useState<string>(() => localStorage.getItem('merge.outDir') || '')
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [running, setRunning] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [total, setTotal] = useState<number>(0)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsubscribe = window.ffmpeg.onVideoMergeStatus((payload) => {
      const { status: st, progress: p, message, outputPath: out } = payload
      if (st === 'start') {
        setRunning(true)
        setStatus('开始合并')
        setProgress(0)
        setOutputPath('')
        if (typeof payload.total === 'number') setTotal(payload.total)
      } else if (st === 'progress') {
        if (typeof p === 'number') setProgress(p)
        setStatus('合并中')
      } else if (st === 'done') {
        setRunning(false)
        setProgress(undefined)
        setStatus('合并完成')
        setOutputPath(out || '')
        setTotal((t) => t)
        toast.success('合并完成')
      } else if (st === 'error') {
        setRunning(false)
        setProgress(undefined)
        setStatus(`错误：${message || ''}`)
        toast.error(`合并失败：${message || ''}`)
      } else if (st === 'canceled') {
        setRunning(false)
        setProgress(undefined)
        setStatus('已取消')
      }
    })
    unsubRef.current = unsubscribe
    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [])

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')
  const canRun = useMemo(() => !!inputDir && !!outputDir && !running, [inputDir, outputDir, running])

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
    setStatus('准备合并')
    setOutputPath('')
    await window.ffmpeg.mergeVideos({ inputDir, outputDir })
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
            <Video className="size-6 text-violet-600 dark:text-violet-400" />
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
                {typeof progress === 'number' && (
                  <span className="text-xs text-muted-foreground">{progress.toFixed(1)}%</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">合并视频数：{total || 0}</div>
              {typeof progress === 'number' && <Progress value={progress} />}
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
