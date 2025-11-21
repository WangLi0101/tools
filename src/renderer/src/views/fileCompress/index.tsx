import GoHome from '@/components/common/goHome'
import MyTabs from '@/components/common/myTabs'
import { FileCog, Music2, Image, Video } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { motion } from 'motion/react'

const FileCompressPage = (): React.JSX.Element => {
  const tabList = [
    {
      label: '图片',
      value: '.',
      icon: <Image className="size-4" />
    },
    {
      label: '视频',
      value: 'video',
      icon: <Video className="size-4" />
    },
    {
      label: '音频',
      value: 'audio',
      icon: <Music2 className="size-4" />
    }
  ]
  return (
    <motion.div
      className="w-full overflow-x-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mx-auto max-w-3xl  space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileCog className="size-6 text-rose-600 dark:text-rose-400" />
            文件压缩
          </h2>
          <GoHome />
        </div>
        <MyTabs tabs={tabList} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </div>
    </motion.div>
  )
}

export default FileCompressPage
