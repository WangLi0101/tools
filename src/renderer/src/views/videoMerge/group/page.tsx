import { FolderOpen, Play, X, Video, Loader2 } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemHeader,
  ItemTitle
} from '@/components/ui/item'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/useStore'
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

  useEffect(() => {
    try {
      localStorage.setItem('group.rule', rule)
    } catch {}
  }, [])
  const [group, setGroup] = useState<GroupItem[]>([])

  const STATUS_MAP = {
    ready: {
      label: '待处理',
      cls: 'bg-muted text-muted-foreground'
    },
    start: {
      label: '合并中',
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    merging: {
      label: '合并中',
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    done: {
      label: '已完成',
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    },
    error: {
      label: '错误',
      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    },
    canceled: {
      label: '已取消',
      cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    }
  } as const

  const fmtBytes = (n: number): string => (n ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : '未知')
  useEffect(() => {
    const statusCallBack = window.ffmpeg.onGroupMergeStatus((payload) => {
      const { groupName, status } = payload
      setGroup((prev) => prev.map((item) => (item.name === groupName ? { ...item, status } : item)))
    })
    return () => {
      statusCallBack()
    }
  }, [])

  // 选择输入文件夹
  const chooseInputDir = async (): Promise<void> => {
    const r = await window.api.selectDirectory()
    if (!r.canceled && r.path) {
      setInputDir(r.path)
      getFilesAndGroup(r.path)
    }
  }
  // 选择输出文件夹
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
  // 开始合并
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
  // 取消合并
  const cancelMerge = async () => {
    if (!isPending) {
      toast.error('请先开始合并')
      return
    }
    await window.ffmpeg.cancelGroupMerge()
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
                <RadioGroup
                  value={selectedFormat}
                  onValueChange={setSelectedFormat}
                  className="grid grid-cols-3 gap-2"
                >
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
                    <div key={fmt} className="flex items-center gap-2 text-xs">
                      <RadioGroupItem value={fmt} id={`group-fmt-${fmt}`} />
                      <label htmlFor={`group-fmt-${fmt}`}>{fmt}</label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">分组规则（正则）</p>
                <Input
                  value={regexText}
                  onChange={(e) => setRegexText(e.target.value)}
                  placeholder="正则，如 ^(\\d{2})_(\\d{8})"
                />
                <div className="text-xs text-muted-foreground">修改正则会立即重新分组</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={start} disabled={isPending}>
                <Play className="size-4" />
                {isPending ? '合并中' : '开始合并'}
              </Button>

              <Button variant="outline" onClick={cancelMerge}>
                <X className="size-4" />
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>分组列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ItemGroup className="gap-2">
              {group.map((item) => (
                <div key={item.name}>
                  <Item variant="outline" size="sm" className="justify-between">
                    <ItemContent>
                      <ItemHeader>
                        <ItemTitle>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(v) =>
                              setGroup((prev) =>
                                prev.map((x) =>
                                  x.name === item.name ? { ...x, selected: !!v } : x
                                )
                              )
                            }
                            disabled={isPending}
                          />
                          <Video className="size-4 text-muted-foreground" />
                          {item.name}
                        </ItemTitle>
                        <ItemActions>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {item.files.length} 个文件
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs inline-flex items-center gap-1 ${STATUS_MAP[item.status]?.cls || STATUS_MAP.ready.cls}`}
                          >
                            {item.status === 'start' || item.status === 'merging' ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            {STATUS_MAP[item.status]?.label || STATUS_MAP.ready.label}
                          </span>
                        </ItemActions>
                      </ItemHeader>
                    </ItemContent>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default GroupPage
