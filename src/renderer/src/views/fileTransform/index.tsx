import GoHome from '@/components/common/goHome'
import MyTabs from '@/components/common/myTabs'
import { Music2, Image, Video, Sparkles } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { motion } from 'motion/react'

const FileTransformPage = (): React.JSX.Element => {
  const tabList = [
    {
      label: '图片转换',
      value: '.',
      icon: <Image className="size-4" />
    },
    {
      label: '视频转换',
      value: 'video',
      icon: <Video className="size-4" />
    },
    {
      label: '音频转换',
      value: 'audio',
      icon: <Music2 className="size-4" />
    }
  ]

  return (
    <div className="w-full relative">
   
      <motion.div
        className="container mx-auto px-4 py-8 max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <Sparkles className="size-5" />
                </span>
                文件格式转换
              </h2>
            </div>
            <GoHome />
          </div>

          {/* Tabs & Content */}
          <div className="space-y-6">
            <MyTabs tabs={tabList} />
            <motion.div
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            
            >
              <Outlet />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default FileTransformPage
