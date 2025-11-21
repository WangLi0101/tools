import MyTabs from '@/components/common/myTabs'
import { Video } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import GoHome from '@/components/common/goHome'
import { motion } from 'motion/react'
const VideoMergePage = (): React.JSX.Element => {
  const tabList = [
    {
      label: '常规',
      value: '.',
      icon: <Video className="size-4" />
    },
    {
      label: '分组',
      value: 'group',
      icon: <Video className="size-4" />
    }
  ]
  return (
    <div className="w-full max-w-5xl mx-auto overflow-x-hidden">
      <div className="mx-auto  space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Video className="size-6 text-cyan-600 dark:text-cyan-400" />
            视频合并
          </h2>
          <GoHome />
        </div>
        <MyTabs tabs={tabList} />
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  )
}

export default VideoMergePage
