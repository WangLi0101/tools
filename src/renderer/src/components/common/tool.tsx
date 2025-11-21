import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Moon, Minus, X, FileDown, Sun, RotateCw, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'motion/react'
import { version } from '../../../../../package.json'

const Tool = (): React.JSX.Element => {
  const { setTheme, theme } = useTheme()
  const [updatePercent, setUpdatePercent] = useState<number | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

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
    if (isChecking) return
    window.api.checkForUpdates()
  }

  useEffect(() => {
    const dispose = window.api.onUpdateStatus((p) => {
      if (p.status === 'checking') {
        setIsChecking(true)
        toast.info('正在检查更新')
      } else {
        setIsChecking(false)
      }

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

      if (p.status === 'update-downloaded') {
        setUpdatePercent(100)
        setDownloaded(true)
        toast.success('更新已下载', {
          action: { label: '重启安装', onClick: () => window.api.quitAndInstall() }
        })
      }

      if (p.status === 'error') {
        toast.error(p.message || '更新失败')
        setUpdatePercent(null)
        setDownloaded(false)
        setIsChecking(false)
      }
    })
    return dispose
  }, [])

  return (
    <div className="tool flex items-center justify-between px-4 py-3 [-webkit-app-region:drag] bg-background/50 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag] select-none">
        <div className="p-1.5 bg-primary/10 rounded-md flex items-center justify-center transition-transform hover:scale-110 duration-200">
          <Wrench className="size-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold leading-none">Desktop Tools</span>
        <span className="text-[10px] text-muted-foreground leading-none">({version})</span>
      </div>

      <div className="flex items-center gap-3 [-webkit-app-region:no-drag]">
        {/* Status & Progress Section */}
        <AnimatePresence mode="wait">
          {typeof updatePercent === 'number' && !downloaded && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-3 mr-2 bg-secondary/50 px-3 py-1.5 rounded-full overflow-hidden"
            >
              <Progress value={updatePercent} className="w-24 h-2" />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {updatePercent}%
              </span>
            </motion.div>
          )}

          {downloaded && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.api.quitAndInstall()}
                className="mr-2 h-8 rounded-full px-4 shadow-sm"
              >
                <RotateCw className="mr-2 size-3.5" />
                重启安装
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tools Group */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleDark}
          className="rounded-full hover:bg-background transition-all duration-300 text-muted-foreground hover:text-foreground relative"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切换主题</span>
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={checkUpdate}
          disabled={isChecking}
          className="rounded-full hover:bg-background transition-all duration-300 text-muted-foreground hover:text-foreground"
        >
          <FileDown className={`h-[1.2rem] w-[1.2rem] ${isChecking ? 'animate-bounce' : ''}`} />
          <span className="sr-only">检查更新</span>
        </Button>
        {/* Window Controls */}
        <div className="flex items-center gap-1.5 ml-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={minimize}
            className="rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Minus className="size-4" />
            <span className="sr-only">最小化</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={quit}
            className="rounded-full hover:bg-red-500 hover:text-white text-muted-foreground transition-colors"
          >
            <X className="size-4" />
            <span className="sr-only">关闭</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Tool
