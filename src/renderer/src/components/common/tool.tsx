import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Moon, Minus, X, FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

const Tool = (): React.JSX.Element => {
  const { setTheme, theme } = useTheme()
  const [updatePercent, setUpdatePercent] = useState<number | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const toggleDark = (): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }
  const minimize = (): void => {
    window.api.minimize()
  }
  const quit = (): void => {
    window.api.quit()
  }
  const checkUpdate = (): void => {
    window.api.checkForUpdates()
  }
  useEffect(() => {
    const dispose = window.api.onUpdateStatus((p) => {
      if (p.status === 'checking') toast.info('正在检查更新')
      if (p.status === 'update-not-available') toast.info('当前已是最新版本')
      if (p.status === 'update-available')
        toast.info(`发现新版本 ${p.info?.version || ''}`, {
          action: {
            label: '下载更新',
            onClick: () => window.api.downloadUpdate()
          }
        })
      if (p.status === 'download-progress') {
        setDownloaded(false)
        setUpdatePercent(Math.max(0, Math.min(100, Math.round(p.percent || 0))))
      }
      if (p.status === 'update-downloaded')
        toast.success('更新已下载', {
          action: { label: '重启安装', onClick: () => window.api.quitAndInstall() }
        })
      if (p.status === 'update-downloaded') {
        setUpdatePercent(100)
        setDownloaded(true)
      }
      if (p.status === 'error') {
        toast.error(p.message || '更新失败')
        setUpdatePercent(null)
        setDownloaded(false)
      }
    })
    return dispose
  }, [])

  return (
    <div className="tool px-4 py-2 flex items-center justify-end gap-2 [-webkit-app-region:drag]">
      <div className="flex items-center gap-1 text-muted-foreground [-webkit-app-region:no-drag]">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="深色模式"
          onClick={toggleDark}
          className="[-webkit-app-region:no-drag]"
        >
          <Moon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="检查更新"
          onClick={checkUpdate}
          className="[-webkit-app-region:no-drag]"
        >
          <FileDown className="size-4" />
        </Button>
        {typeof updatePercent === 'number' && !downloaded ? (
          <div className="flex items-center gap-2 w-36">
            <Progress value={updatePercent} />
            <div className="text-xs text-muted-foreground">{updatePercent}%</div>
          </div>
        ) : null}
        {downloaded ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.api.quitAndInstall()}
            className="[-webkit-app-region:no-drag]"
          >
            重启安装
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="最小化"
          onClick={minimize}
          className="[-webkit-app-region:no-drag]"
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="关闭"
          onClick={quit}
          className="[-webkit-app-region:no-drag]"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export default Tool
