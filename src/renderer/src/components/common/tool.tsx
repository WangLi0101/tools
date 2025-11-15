import { Button } from '@/components/ui/button'
import { FileCog, Moon, Minus, X, FileDown } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { version } from '../../../../../package.json'
const Tool = (): React.JSX.Element => {
  const { setTheme, theme } = useTheme()
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
      if (p.status === 'download-progress')
        toast.info(`下载进度 ${Math.round(p.percent || 0)}%`)
      if (p.status === 'update-downloaded')
        toast.success('更新已下载', {
          action: { label: '重启安装', onClick: () => window.api.quitAndInstall() }
        })
      if (p.status === 'error') toast.error(p.message || '更新失败')
    })
    return dispose
  }, [])

  return (
    <div className="tool px-3 py-2  from-white/70 via-indigo-50/60 to-white/70 dark:from-muted/25 dark:via-muted/20 dark:to-muted/25 ring-1 ring-indigo-100/70 dark:ring-input shadow-sm flex items-center justify-between [-webkit-app-region:drag]">
      <div className="flex items-center gap-2 text-foreground">
        <FileCog className="size-5 text-primary" />
        <span className="text-sm font-medium">工具箱</span>
        <span className="text-sm text-primary">v{version}</span>
      </div>
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
