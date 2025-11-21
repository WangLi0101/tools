import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  FileSliders,
  FileCog,
  PlayCircle,
  FileDown,
  Video,
  ScreenShare,
  LayoutGrid,
  Settings,
  Sparkles
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname

  const items = [
    {
      title: 'Dashboard',
      icon: LayoutGrid,
      href: '/',
      variant: 'ghost'
    },
    {
      title: 'File Transform',
      icon: FileSliders,
      href: '/fileTransForm',
      variant: 'ghost'
    },
    {
      title: 'File Compress',
      icon: FileCog,
      href: '/fileCompress',
      variant: 'ghost'
    },
    {
      title: 'M3U8 Download',
      icon: PlayCircle,
      href: '/m3u8',
      variant: 'ghost'
    },
    {
      title: 'PDF Generator',
      icon: FileDown,
      href: '/pdf',
      variant: 'ghost'
    },
    {
      title: 'Video Merge',
      icon: Video,
      href: '/videoMerge',
      variant: 'ghost'
    },
    {
      title: 'Screen Record',
      icon: ScreenShare,
      href: '/screenRecord',
      variant: 'ghost'
    }
  ]

  return (
    <div className={cn('pb-12 w-64 border-r bg-sidebar text-sidebar-foreground', className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-4 mb-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Toolkit</h2>
          </div>
          <div className="space-y-1">
            {items.map((item) => (
              <Button
                key={item.href}
                variant={
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    ? 'secondary'
                    : 'ghost'
                }
                className="w-full justify-start"
                onClick={() => navigate(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Button>
            ))}
          </div>
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Settings</h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
