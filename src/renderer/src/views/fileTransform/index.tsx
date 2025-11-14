import GoHome from '@/components/common/goHome'
import MyTabs from '@/components/common/myTabs'
import { FileCog, Music2, Image, Video } from 'lucide-react'
import { Outlet } from 'react-router-dom'

const FileTransformPage = (): React.JSX.Element => {
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
    <div className="min-h-svh w-full overflow-x-hidden bg-gradient-to-b from-background to-muted/40 dark:from-muted/20 dark:to-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileCog className="size-6 text-sky-600" />
            文件转换
          </h2>
          <GoHome />
        </div>
        <MyTabs tabs={tabList} />
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default FileTransformPage
