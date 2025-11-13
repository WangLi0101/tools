import * as React from 'react'
import { FileCog, Download } from 'lucide-react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
const HomePage = (): React.JSX.Element => {
  const items = [
    {
      title: '文件转换',
      description: '轻松转换各种文件格式，支持图像、视频、音频',
      icon: <FileCog className="size-6 text-sky-600" />,
      accentClasses: 'bg-sky-50 ring-1 ring-sky-200',
      url: '/fileTransForm'
    },
    {
      title: '文件压缩',
      description: '高效压缩文件，节省存储空间，同时保持良好的质量',
      icon: <Download className="size-6 text-emerald-600" />,
      accentClasses: 'bg-emerald-50 ring-1 ring-emerald-200',
      url: '/fileTransForm'
    }
  ]
  const navigate = useNavigate()
  const go = (url: string): void => {
    navigate(url)
  }
  return (
    <div className="min-h-svh w-full overflow-x-hidden bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-2xl px-6 py-8">
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
              className={cn(
                'cursor-pointer items-center hover:shadow-sm transition-shadow',
                item.accentClasses
              )}
            >
              <ItemMedia className="self-center! translate-y-0!">{item.icon}</ItemMedia>
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
