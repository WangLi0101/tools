import { FolderOpen, Play, X } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
interface GroupItem {
  name: string
  files: string[]
  status: 'ready' | 'merging' | 'done' | 'error'
}
const GroupPage = (): React.JSX.Element => {
  const [isPending, startTransition] = useTransition()
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
  const [group, setGroup] = useState<GroupItem[]>([])

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
      localStorage.setItem('group.outDir', r.path)
      const ds = await window.api.getDiskSpace(r.path)
      setDisk({ total: ds.totalBytes, free: ds.freeBytes })
    }
  }

  // 获取文件并分组
  const getFilesAndGroup = async (path: string): Promise<void> => {
    const res = await window.ffmpeg.scanVideoGruopFiles({
      inputDir: path,
      formats: selectedFormats
    })
    groupAndMerge(res.files)
  }

  const groupAndMerge = (files: { url: string; createTime: number }[]) => {
    const map = new Map<string, string[]>()
    for (const f of files) {
      const base = f.url.split(/[\\/]/).pop() || ''
      const m = base.match(/^(\d{2})_(\d{8})/)
      const key = m ? `${m[1]}_${m[2]}` : 'unknown'
      const list = map.get(key) || []
      list.push(f.url)
      map.set(key, list)
    }
    const result: GroupItem[] = []
    for (const [name, list] of map) {
      result.push({ name, files: list, status: 'ready' })
    }
    result.sort((a, b) => a.name.localeCompare(b.name))
    setGroup(result)
  }
  // 开始合并
  const start = async () => {
    if (!outputDir) {
      toast.error('请选择输出文件夹')
      return
    }
    if (!group.length) {
      toast.error('请先选择要合并的视频')
      return
    }
    startTransition(async () => {
      try {
        await window.ffmpeg.groupMergeStart({
          outputDir,
          group
        })
        toast.success('合并完成')
      } catch {
        toast.error('合并失败')
      }
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
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFormats([...selectedFormats, fmt])
                          } else {
                            setSelectedFormats(selectedFormats.filter((f) => f !== fmt))
                          }
                        }}
                      />
                      <span>{fmt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={start} disabled={isPending}>
                <Play className="size-4" />
                {isPending ? '合并中' : '开始合并'}
              </Button>

              <Button variant="outline">
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
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {group.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.files.length} 个文件</span>
                  <span className="text-xs text-muted-foreground">{item.status}</span>
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
