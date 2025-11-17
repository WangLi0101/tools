import * as React from 'react'
import { FileCog, PlayCircle, FileSliders, FileDown, Video } from 'lucide-react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
const HomePage = (): React.JSX.Element => {
  const accents = {
    blue: {
      card: 'bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:border-blue-800',
      iconWrap: 'bg-blue-100 dark:bg-blue-900/40',
      icon: 'text-blue-600 dark:text-blue-400'
    },
    violet: {
      card: 'bg-violet-50 hover:bg-violet-100 border-violet-200 dark:bg-violet-900/20 dark:hover:bg-violet-900/30 dark:border-violet-800',
      iconWrap: 'bg-violet-100 dark:bg-violet-900/40',
      icon: 'text-violet-600 dark:text-violet-400'
    },
    emerald: {
      card: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 dark:border-emerald-800',
      iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40',
      icon: 'text-emerald-600 dark:text-emerald-400'
    },
    indigo: {
      card: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 dark:border-indigo-800',
      iconWrap: 'bg-indigo-100 dark:bg-indigo-900/40',
      icon: 'text-indigo-600 dark:text-indigo-400'
    },
    rose: {
      card: 'bg-rose-50 hover:bg-rose-100 border-rose-200 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 dark:border-rose-800',
      iconWrap: 'bg-rose-100 dark:bg-rose-900/40',
      icon: 'text-rose-600 dark:text-rose-400'
    },
    amber: {
      card: 'bg-amber-50 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 dark:border-amber-800',
      iconWrap: 'bg-amber-100 dark:bg-amber-900/40',
      icon: 'text-amber-600 dark:text-amber-400'
    },
    cyan: {
      card: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/30 dark:border-cyan-800',
      iconWrap: 'bg-cyan-100 dark:bg-cyan-900/40',
      icon: 'text-cyan-600 dark:text-cyan-400'
    },
    teal: {
      card: 'bg-teal-50 hover:bg-teal-100 border-teal-200 dark:bg-teal-900/20 dark:hover:bg-teal-900/30 dark:border-teal-800',
      iconWrap: 'bg-teal-100 dark:bg-teal-900/40',
      icon: 'text-teal-600 dark:text-teal-400'
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
    }
  ]
  const navigate = useNavigate()
  const go = (url: string): void => {
    navigate(url)
  }
  return (
    <motion.div
      className="w-full overflow-x-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="px-3 py-8">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-foreground">常用工具</h1>
          <p className="text-sm text-muted-foreground">快速开始你的文件处理</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item, index) => {
            const accent = accents[item.theme as keyof typeof accents]
            const Icon = item.Icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.995 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
              >
                <Item
                  onClick={() => go(item.url)}
                  variant="outline"
                  className={cn(
                    'cursor-pointer items-center hover:shadow-md transition-shadow',
                    accent.card
                  )}
                >
                  <ItemMedia className="self-center! translate-y-0! ">
                    <div
                      className={cn(
                        'rounded-xl p-2 transition-transform group-hover/item:scale-105',
                        accent.iconWrap
                      )}
                    >
                      <Icon className={cn('size-6', accent.icon)} />
                    </div>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.description}</ItemDescription>
                  </ItemContent>
                </Item>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

export default HomePage
