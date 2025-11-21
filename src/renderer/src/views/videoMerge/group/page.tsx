import {
  Play,
  X,
  Video,
  Loader2,
  FolderInput,
  FolderOutput,
  Settings2,
  FileCode,
  ListVideo,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  Search
} from 'lucide-react'
import { useEffect, useState, useCallback, createElement } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/useStore'
import { cn } from '@/lib/utils'

interface GroupItem {
  name: string
  files: string[]
  status: 'ready' | 'start' | 'done' | 'error' | 'canceled' | 'merging'
  selected: boolean
}

const GroupPage = (): React.JSX.Element => {
  const [isPending, setIsPending] = useState(false)
  const [inputDir, setInputDir] = useState<string>('')
  const [outputDir, setOutputDir] = useStorage<string>('group.outDir', '')
  const [disk, setDisk] = useState<{ total: number; free: number }>({ total: 0, free: 0 })

  const defaultSelectedFormat = (() => {
    try {
      const raw = localStorage.getItem('group.format') ?? localStorage.getItem('group.formats')
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
    'group.format',
    defaultSelectedFormat
  )

  const rule = 'regex'
  const [regexText, setRegexText] = useStorage<string>('group.regex', '^(\\d{2})_(\\d{8})')
  const [filesRaw, setFilesRaw] = useState<{ url: string; createTime: number }[]>([])
  const [group, setGroup] = useState<GroupItem[]>([])

  useEffect(() => {
    try {
      localStorage.setItem('group.rule', rule)
    } catch {}
  }, [])

  const STATUS_MAP = {
    ready: {
      label: '待处理',
      cls: 'bg-muted text-muted-foreground',
      icon: null
    },
    start: {
      label: '准备中',
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: Loader2
    },
    merging: {
      label: '合并中',
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: Loader2
    },
    done: {
      label: '已完成',
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: CheckCircle2
    },
    error: {
      label: '错误',
      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      icon: AlertCircle
    },
    canceled: {
      label: '已取消',
      cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: AlertCircle
    }
  } as const

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')

  useEffect(() => {
    const unsubscribe = window.ffmpeg.onGroupMergeStatus((payload) => {
      const { groupName, status } = payload
      setGroup((prev) => prev.map((item) => (item.name === groupName ? { ...item, status } : item)))
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const chooseInputDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setInputDir(r.path)
      getFilesAndGroup(r.path)
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

  const groupAndMerge = useCallback(
    (files: { url: string; createTime: number }[]) => {
      const map = new Map<string, { url: string; createTime: number }[]>()
      for (const f of files) {
        let key = 'unknown'
        const base = f.url.split(/[\\/]/).pop() || ''
        try {
          const re = new RegExp(regexText)
          const m = base.match(re)
          if (m) {
            const groups = m.slice(1)
            key = groups.length ? groups.join('_') : m[0]
          } else {
            key = 'unknown'
          }
        } catch {
          key = 'unknown'
        }
        const list = map.get(key) || []
        list.push({ url: f.url, createTime: f.createTime })
        map.set(key, list)
      }
      const result: Omit<GroupItem, 'status' | 'selected'>[] = []
      for (const [name, list] of map) {
        const sorted = list.slice().sort((a, b) => a.createTime - b.createTime)
        result.push({ name, files: sorted.map((x) => x.url) })
      }
      result.sort((a, b) => a.name.localeCompare(b.name))
      setGroup((prev) =>
        result.map((item) => {
          const old = prev.find((x) => x.name === item.name)
          return {
            name: item.name,
            files: item.files,
            status: old?.status ?? 'ready',
            selected: old?.selected ?? true
          }
        })
      )
    },
    [regexText]
  )

  const getFilesAndGroup = useCallback(
    async (path: string): Promise<void> => {
      const res = await window.ffmpeg.scanVideoGruopFiles({
        inputDir: path,
        formats: [selectedFormat]
      })
      setFilesRaw(res.files)
      groupAndMerge(res.files)
    },
    [selectedFormat, groupAndMerge]
  )

  useEffect(() => {
    if (inputDir) getFilesAndGroup(inputDir)
  }, [selectedFormat, inputDir, getFilesAndGroup])

  useEffect(() => {
    if (filesRaw.length) groupAndMerge(filesRaw)
  }, [regexText, filesRaw, groupAndMerge])

  const start = async () => {
    if (!outputDir) {
      toast.error('请选择输出文件夹')
      return
    }
    const selectedGroups = group.filter((g) => g.selected)
    if (!selectedGroups.length) {
      toast.error('请先选择要合并的视频')
      return
    }
    setIsPending(true)
    try {
      await window.ffmpeg.groupMergeStart({
        outputDir,
        group: selectedGroups.map((g) => ({ name: g.name, files: g.files }))
      })
      toast.success('合并完成')
    } catch {
      toast.error('合并失败')
    } finally {
      setIsPending(false)
    }
  }

  const cancelMerge = async () => {
    if (!isPending) {
      toast.error('请先开始合并')
      return
    }
    await window.ffmpeg.cancelGroupMerge()
  }

  const formats = ['mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'ts', 'mts', 'm2ts', 'flv', 'wmv']

  return (
    <div className="w-full h-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="size-4" />
                配置选项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Input/Output Group */}
              <div className="space-y-4">
                <div
                  className={cn(
                    'relative group cursor-pointer rounded-lg border border-dashed p-3 transition-colors hover:bg-accent/50',
                    !inputDir && 'bg-accent/20'
                  )}
                  onClick={chooseInputDir}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border shadow-sm group-hover:scale-105 transition-transform">
                      <FolderInput className="size-4 text-blue-600 dark:text-blue-400" />
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
                    'relative group cursor-pointer rounded-lg border border-dashed p-3 transition-colors hover:bg-accent/50',
                    !outputDir && 'bg-accent/20'
                  )}
                  onClick={chooseOutputDir}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-full border shadow-sm group-hover:scale-105 transition-transform">
                      <FolderOutput className="size-4 text-green-600 dark:text-green-400" />
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

              {/* Format Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileVideo className="size-4" />
                  视频格式
                </label>
                <RadioGroup
                  value={selectedFormat}
                  onValueChange={setSelectedFormat}
                  className="grid grid-cols-4 gap-2"
                >
                  {formats.map((fmt) => (
                    <label
                      key={fmt}
                      className={cn(
                        'cursor-pointer flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary',
                        selectedFormat === fmt &&
                          'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      )}
                    >
                      <RadioGroupItem value={fmt} id={`group-fmt-${fmt}`} className="sr-only" />
                      {fmt.toUpperCase()}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              {/* Regex Input */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileCode className="size-4" />
                  分组规则 (正则表达式)
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={regexText}
                    onChange={(e) => setRegexText(e.target.value)}
                    placeholder="例如: ^(\d{2})_(\\d{8})"
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  正则捕获组将作为分组依据，修改后立即生效
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2 mt-auto">
                <Button
                  onClick={start}
                  disabled={isPending}
                  className={cn('w-full', isPending && 'opacity-80')}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      合并中
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 size-4" />
                      开始
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelMerge}
                  disabled={!isPending}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="mr-2 size-4" />
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Group List */}
        <div className="lg:col-span-2 h-[calc(100vh-140px)]">
          <Card className="h-full shadow-sm flex flex-col">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListVideo className="size-4" />
                  分组预览
                  <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {group.length} 个分组
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={group.length > 0 && group.every((g) => g.selected)}
                    onCheckedChange={(checked) => {
                      setGroup((prev) => prev.map((item) => ({ ...item, selected: !!checked })))
                    }}
                  />
                  <label htmlFor="select-all" className="text-xs cursor-pointer select-none">
                    全选
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {group.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                  <div className="p-4 rounded-full bg-muted/50">
                    <Video className="size-8 opacity-50" />
                  </div>
                  <p className="text-sm">暂无分组，请选择输入文件夹或调整正则规则</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {group.map((item) => (
                      <div
                        key={item.name}
                        className={cn(
                          'group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all hover:shadow-sm hover:border-primary/30',
                          !item.selected && 'opacity-60 bg-muted/20'
                        )}
                      >
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(v) =>
                            setGroup((prev) =>
                              prev.map((x) => (x.name === item.name ? { ...x, selected: !!v } : x))
                            )
                          }
                          disabled={isPending}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Video className="size-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.files.length} 个片段</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                              STATUS_MAP[item.status]?.cls || STATUS_MAP.ready.cls
                            )}
                          >
                            {item.status === 'start' || item.status === 'merging' ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : STATUS_MAP[item.status].icon ? (
                              createElement(STATUS_MAP[item.status].icon!, { className: 'size-3' })
                            ) : null}
                            {STATUS_MAP[item.status]?.label || STATUS_MAP.ready.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
export default GroupPage
