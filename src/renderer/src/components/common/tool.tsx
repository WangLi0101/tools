import { Button } from '@/components/ui/button'
import { FileCog, Moon, Minus, X } from 'lucide-react'
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
