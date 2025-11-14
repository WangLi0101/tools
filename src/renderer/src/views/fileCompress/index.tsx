import GoHome from '@/components/common/goHome'
import MyTabs from '@/components/common/myTabs'
import { FileCog, Music2, Image, Video } from 'lucide-react'
import { Outlet } from 'react-router-dom'

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
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto max-w-3xl px-3 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileCog className="size-6" />
            文件压缩
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

export default FileCompressPage
