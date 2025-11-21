import * as React from 'react'
import {
  FileCog,
  PlayCircle,
  FileSliders,
  FileDown,
  Video,
  ScreenShare,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import ScrollToTop from '@/components/common/scrollTop'

const HomePage = (): React.JSX.Element => {
  const accents = {
    blue: {
      border: 'group-hover:border-blue-500/50 dark:group-hover:border-blue-400/50',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
      icon: 'text-blue-600 dark:text-blue-400',
      gradient: 'from-blue-500/20 to-transparent'
    },
    violet: {
      border: 'group-hover:border-violet-500/50 dark:group-hover:border-violet-400/50',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      iconBg: 'bg-violet-100 dark:bg-violet-900/50',
      icon: 'text-violet-600 dark:text-violet-400',
      gradient: 'from-violet-500/20 to-transparent'
    },
    emerald: {
      border: 'group-hover:border-emerald-500/50 dark:group-hover:border-emerald-400/50',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      icon: 'text-emerald-600 dark:text-emerald-400',
      gradient: 'from-emerald-500/20 to-transparent'
    },
    indigo: {
      border: 'group-hover:border-indigo-500/50 dark:group-hover:border-indigo-400/50',
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
      icon: 'text-indigo-600 dark:text-indigo-400',
      gradient: 'from-indigo-500/20 to-transparent'
    },
    rose: {
      border: 'group-hover:border-rose-500/50 dark:group-hover:border-rose-400/50',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      iconBg: 'bg-rose-100 dark:bg-rose-900/50',
      icon: 'text-rose-600 dark:text-rose-400',
      gradient: 'from-rose-500/20 to-transparent'
    },
    amber: {
      border: 'group-hover:border-amber-500/50 dark:group-hover:border-amber-400/50',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
      icon: 'text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-500/20 to-transparent'
    },
    cyan: {
      border: 'group-hover:border-cyan-500/50 dark:group-hover:border-cyan-400/50',
      bg: 'bg-cyan-50 dark:bg-cyan-950/30',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/50',
      icon: 'text-cyan-600 dark:text-cyan-400',
      gradient: 'from-cyan-500/20 to-transparent'
    },
    teal: {
      border: 'group-hover:border-teal-500/50 dark:group-hover:border-teal-400/50',
      bg: 'bg-teal-50 dark:bg-teal-950/30',
      iconBg: 'bg-teal-100 dark:bg-teal-900/50',
      icon: 'text-teal-600 dark:text-teal-400',
      gradient: 'from-teal-500/20 to-transparent'
    }
  } as const

  const items = [
    {
      title: '文件转换',
      description: '轻松转换各种文件格式，支持图像、视频、音频',
      Icon: FileSliders,
      url: '/fileTransForm',
      theme: 'indigo'
    },
    {
      title: '文件压缩',
      description: '轻松压缩各种文件格式，支持图像、视频、音频',
      Icon: FileCog,
      url: '/fileCompress',
      theme: 'rose'
    },
    {
      title: 'm3u8下载',
      description: '支持m3u8视频下载',
      Icon: PlayCircle,
      url: '/m3u8',
      theme: 'teal'
    },
    {
      title: 'PDF生成',
      description: '支持网页生成PDF文件',
      Icon: FileDown,
      url: '/pdf',
      theme: 'amber'
    },
    {
      title: '视频合并',
      description: '支持合并多个视频文件',
      Icon: Video,
      url: '/videoMerge',
      theme: 'cyan'
    },
    {
      title: '屏幕录制',
      description: '支持屏幕录制',
      Icon: ScreenShare,
      url: '/screenRecord',
      theme: 'violet'
    }
  ]
  const navigate = useNavigate()
  const go = (url: string): void => {
    navigate(url)
  }

  return (
    <div className="min-h-screen w-full bg-background selection:bg-primary/10">
      <ScrollToTop />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 max-w-7xl"
      >
        {/* Hero Section */}
        <div className="mb-16 text-center relative">
          <div className="absolute inset-0 flex justify-center blur-[80px] opacity-30">
            <div className="h-[200px] w-[600px] bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full" />
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center justify-center p-1.5 mb-6 rounded-full bg-muted/50 backdrop-blur-sm border border-border/50"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-0.5 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>高效能工具集</span>
            </span>
          </motion.div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl mb-6">
            <span className="block">你的全能</span>
            <span className="bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              数字处理助手
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
            集合了格式转换、媒体处理、文档生成等多种实用工具，
            <br className="hidden sm:inline" />
            让繁琐的工作变得简单高效。
          </p>
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const accent = accents[item.theme as keyof typeof accents]
            const Icon = item.Icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
                className="group h-full"
              >
                <Card
                  className={cn(
                    'relative h-full overflow-hidden border-muted transition-all duration-300 cursor-pointer',
                    'hover:shadow-xl hover:-translate-y-1 hover:shadow-primary/5',
                    accent.border
                  )}
                  onClick={() => go(item.url)}
                >
                  {/* Background Gradient Effect */}
                  <div
                    className={cn(
                      'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br',
                      accent.gradient
                    )}
                  />

                  <CardContent className="relative z-10 flex items-start gap-4 p-6">
                    <div
                      className={cn(
                        'shrink-0 p-3 rounded-xl transition-colors duration-300',
                        accent.iconBg
                      )}
                    >
                      <Icon className={cn('size-6', accent.icon)} />
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <CardTitle className="text-lg font-semibold  transition-colors truncate">
                          {item.title}
                        </CardTitle>
                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 shrink-0">
                          <ArrowRight className={cn('size-4', accent.icon)} />
                        </div>
                      </div>
                      <CardDescription className="text-sm leading-relaxed line-clamp-2">
                        {item.description}
                      </CardDescription>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-16 text-center">
          <p className="text-xs text-muted-foreground/50">
            © 2024 Desktop Tools. Designed for productivity.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default HomePage
