import { FolderOpen, Play, Pause, X, FileText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

type GroupStatus = 'waiting' | 'merging' | 'paused' | 'done' | 'error' | 'canceled'
interface GroupItem {
  key: string
  lens: string
  date: string
  files: string[]
  status: GroupStatus
  progress?: number
  outputPath?: string
  lastMessage?: string
}

const GroupPage = (): React.JSX.Element => {
  const [inputDir, setInputDir] = useState<string>('')
  const [outputDir, setOutputDir] = useState<string>(
    () => localStorage.getItem('group.outDir') || ''
  )
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('group.formats')
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length) return arr
      }
    } catch {}
    return ['mp4']
  })
  const [groups, setGroups] = useState<GroupItem[]>([])
  const groupsRef = useRef<GroupItem[]>([])
  const [running, setRunning] = useState<boolean>(false)
  const [pauseRequested, setPauseRequested] = useState<boolean>(false)
  const pauseRef = useRef<boolean>(false)
  const [currentTaskId, setCurrentTaskId] = useState<string>('')

  const unsubRef = useRef<(() => void) | null>(null)
  const startRequestedRef = useRef<boolean>(false)

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')

  const canRun = useMemo(
    () =>
      !!inputDir &&
      !!outputDir &&
      selectedFormats.length > 0 &&
      groups.some((g) => g.status === 'waiting' || g.status === 'error' || g.status === 'paused') &&
      !running,
    [inputDir, outputDir, selectedFormats.length, groups, running]
  )

  const normalizePath = (p: string): string => String(p || '').replace(/[\\/]+/g, '/')
  const getBaseName = (p: string): string => {
    const n = normalizePath(p)
    const idx = n.lastIndexOf('/')
    return idx >= 0 ? n.slice(idx + 1) : n
  }

  const chooseInputDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setInputDir(r.path)
      await scanAndGroup(r.path)
    }
  }
  const chooseOutputDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setOutputDir(r.path)
      localStorage.setItem('group.outDir', r.path)
      const ds = await window.api.getDiskSpace(r.path)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    }
  }

  const parseGroupKey = (name: string): { lens?: string; date?: string; time?: string } => {
    const m = name.match(/^(\d{2})_(\d{8})(\d{6})/)
    if (m) return { lens: m[1], date: m[2], time: m[3] }
    const m2 = name.match(/^(\d{2})_(\d{8})/)
    if (m2) return { lens: m2[1], date: m2[2] }
    return {}
  }

  const scanAndGroup = async (dir: string): Promise<void> => {
    try {
      const { files } = await window.ffmpeg.scanVideoFiles({
        inputDir: dir,
        formats: selectedFormats
      })
      if (!files || !files.length) {
        setGroups([])
        toast.error('未找到视频文件')
        return
      }
      const map = new Map<string, GroupItem>()
      for (const f of files) {
        const bn = getBaseName(f)
        const { lens, date } = parseGroupKey(bn)
        if (!lens || !date) continue
        const key = `${lens}_${date}`
        const g = map.get(key) || { key, lens, date, files: [], status: 'waiting' }
        g.files.push(f)
        map.set(key, g)
      }
      const arr = Array.from(map.values())
      for (const g of arr) {
        g.files.sort((a, b) => {
          const an = getBaseName(a)
          const bn = getBaseName(b)
          const pa = parseGroupKey(an)
          const pb = parseGroupKey(bn)
          const ta = pa.time ? parseInt(pa.time) : 0
          const tb = pb.time ? parseInt(pb.time) : 0
          if (ta !== tb) return ta - tb
          return an.localeCompare(bn)
        })
      }
      arr.sort((a, b) => {
        if (a.lens !== b.lens) return a.lens.localeCompare(b.lens)
        return a.date.localeCompare(b.date)
      })
      groupsRef.current = arr
      setGroups(arr)
    } catch (e) {
      toast.error(`扫描失败：${String(e || '')}`)
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem('group.formats', JSON.stringify(selectedFormats))
    } catch {}
  }, [selectedFormats])

  useEffect(() => {
    pauseRef.current = pauseRequested
  }, [pauseRequested])

  useEffect(() => {
    const unsubscribe = window.ffmpeg.onVideoGroupStatus((payload) => {
      const { taskId, status, progress, outputPath, message } = payload
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.key === taskId)
        if (idx < 0) return prev
        const g = { ...prev[idx] }
        if (status === 'start') {
          setRunning(true)
          setPauseRequested(false)
          setCurrentTaskId(taskId)
          g.status = 'merging'
          g.progress = 0
          g.lastMessage = ''
        } else if (status === 'progress') {
          g.status = 'merging'
          if (typeof progress === 'number') g.progress = progress
          if (typeof message === 'string') g.lastMessage = message
        } else if (status === 'done') {
          g.status = 'done'
          g.progress = undefined
          g.outputPath = outputPath || ''
        } else if (status === 'error') {
          g.status = 'error'
          g.progress = undefined
          g.lastMessage = message || ''
        } else if (status === 'canceled') {
          g.status = pauseRef.current ? 'paused' : 'canceled'
          g.progress = undefined
        }
        const next = [...prev]
        next[idx] = g
        groupsRef.current = next
        return next
      })

      if ((status === 'done' || status === 'error') && startRequestedRef.current) {
        runNext()
      } else if (status === 'canceled') {
        setRunning(false)
      }
    })
    unsubRef.current = unsubscribe
    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [])

  const runNext = async (): Promise<void> => {
    if (!startRequestedRef.current) return
    if (pauseRef.current) {
      setRunning(false)
      return
    }
    const next = groupsRef.current.find(
      (g) => g.status === 'waiting' || g.status === 'error' || g.status === 'paused'
    )
    if (!next) {
      setRunning(false)
      startRequestedRef.current = false
      toast.success('所有分组已完成')
      return
    }
    setRunning(true)
    setCurrentTaskId(next.key)
    await window.ffmpeg.mergeVideosByList({
      taskId: next.key,
      files: next.files,
      outputDir,
      outputName: next.key,
      noProgress: false
    })
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
    if (!groups.length) {
      toast.error('没有可合并的分组')
      return
    }
    startRequestedRef.current = true
    setPauseRequested(false)
    await runNext()
  }

  const onPause = async (): Promise<void> => {
    if (!running) return
    setPauseRequested(true)
    await window.ffmpeg.cancelVideoGroup(currentTaskId)
  }

  const onCancelAll = async (): Promise<void> => {
    setPauseRequested(false)
    setRunning(false)
    setCurrentTaskId('')
    await window.ffmpeg.cancelVideoGroup()
    setGroups((prev) => {
      const next: GroupItem[] = prev.map((g) => ({
        ...g,
        status: 'waiting' as GroupStatus,
        progress: undefined
      }))
      groupsRef.current = next
      return next
    })
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>分组合并</CardTitle>
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
                        onCheckedChange={async (checked) => {
                          setSelectedFormats((prev) => {
                            const next =
                              checked === true
                                ? Array.from(new Set([...prev, fmt]))
                                : prev.filter((x) => x !== fmt)
                            return next
                          })
                          if (inputDir) await scanAndGroup(inputDir)
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
                开始
              </Button>
              <Button variant="outline" onClick={onPause} disabled={!running}>
                <Pause className="size-4" />
                暂停
              </Button>
              <Button variant="outline" onClick={onCancelAll}>
                <X className="size-4" />
                取消
              </Button>
            </div>

            <div className="space-y-2">
              {groups.length === 0 && <div className="text-xs text-muted-foreground">暂无分组</div>}
              {groups.map((g) => (
                <div key={g.key} className="rounded border p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {g.key}（{g.files.length}）
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.status === 'waiting' && '等待'}
                      {g.status === 'merging' && '进行中'}
                      {g.status === 'paused' && '已暂停'}
                      {g.status === 'done' && '已完成'}
                      {g.status === 'error' && '错误'}
                      {g.status === 'canceled' && '已取消'}
                    </div>
                  </div>
                  {typeof g.progress === 'number' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {g.progress.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={g.progress} />
                    </div>
                  )}
                  {g.outputPath && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground break-all">
                      <FileText className="size-4" />
                      输出：{g.outputPath}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default GroupPage
