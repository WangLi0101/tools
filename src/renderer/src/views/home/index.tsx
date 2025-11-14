import * as React from 'react'
import { FileCog, PlayCircle } from 'lucide-react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
const HomePage = (): React.JSX.Element => {
  const items = [
    {
      title: '文件转换',
      description: '轻松转换各种文件格式，支持图像、视频、音频',
      icon: <FileCog className="size-6 " />,
      url: '/fileTransForm'
    },
    {
      title: '文件压缩',
      description: '轻松压缩各种文件格式，支持图像、视频、音频',
      icon: <FileCog className="size-6 " />,
      url: '/fileCompress'
    },
    {
      title: 'm3u8下载',
      description: '支持m3u8视频下载',
      icon: <PlayCircle className="size-6" />,
      url: '/m3u8'
    }
  ]
  const navigate = useNavigate()
  const go = (url: string): void => {
    navigate(url)
  }
  return (
    <div className="w-full overflow-x-hidden">
      <div className="px-3 py-8">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-foreground">常用工具</h1>
          <p className="text-sm text-muted-foreground">快速开始你的文件处理</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Item
                onClick={() => go(item.url)}
                variant="outline"
                className={cn('cursor-pointer items-center hover:shadow-sm transition-shadow')}
              >
                <ItemMedia className="self-center! translate-y-0! ">{item.icon}</ItemMedia>
                <ItemContent>
                  <ItemTitle>{item.title}</ItemTitle>
                  <ItemDescription>{item.description}</ItemDescription>
                </ItemContent>
              </Item>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HomePage
