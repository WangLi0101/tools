import * as React from 'react'
import { FileCog } from 'lucide-react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
const HomePage = (): React.JSX.Element => {
  const items = [
    {
      title: '文件转换',
      description: '轻松转换各种文件格式，支持图像、视频、音频',
      icon: <FileCog className="size-6 text-sky-600" />,

      url: '/fileTransForm'
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
            <Item
              onClick={() => go(item.url)}
              variant="outline"
              key={index}
              className={cn('cursor-pointer items-center hover:shadow-sm transition-shadow')}
            >
              <ItemMedia className="self-center! translate-y-0! ">{item.icon}</ItemMedia>
              <ItemContent>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemDescription>{item.description}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HomePage
