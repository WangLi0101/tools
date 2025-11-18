import { useRoutes } from 'react-router-dom'
import HomePage from '@/views/home'
import FileTransformPage from '@/views/fileTransform'
import VideoPage from '@/views/fileTransform/video/page'
import ImagePage from '@/views/fileTransform/image/page'
import AudioPage from '@/views/fileTransform/audio/page'
import FileCompressPage from '@/views/fileCompress'
import CompressImagePage from '@/views/fileCompress/image/page'
import CompressVideoPage from '@/views/fileCompress/video/page'
import CompressAudioPage from '@/views/fileCompress/audio/page'
import M3u8 from '@/views/m3u8'
import Pdf from '@/views/pdf'
import VideoMergePage from '@/views/videoMerge/page'
import Merge from '@/views/videoMerge/merge/page'
import GroupPage from '@/views/videoMerge/group/page'
import ScreenRecord from '@/views/screenRecord/page'
import ScrollToTop from '@/components/common/scrollTop'

const routeList = [
  {
    path: '/',
    element: <HomePage />
  },
  {
    path: '/fileTransForm',
    element: <FileTransformPage />,
    children: [
      {
        index: true,
        element: <ImagePage />
      },
      {
        path: 'video',
        element: <VideoPage />
      },
      {
        path: 'audio',
        element: <AudioPage />
      }
    ]
  },
  {
    path: '/fileCompress',
    element: <FileCompressPage />,
    children: [
      {
        index: true,
        element: <CompressImagePage />
      },
      {
        path: 'video',
        element: <CompressVideoPage />
      },
      {
        path: 'audio',
        element: <CompressAudioPage />
      }
    ]
  },
  {
    path: '/m3u8',
    element: <M3u8 />
  },
  {
    path: '/pdf',
    element: <Pdf />
  },
  {
    path: '/videoMerge',
    element: <VideoMergePage />,
    children: [
      {
        index: true,
        element: <Merge />
      },
      {
        path: 'group',
        element: <GroupPage />
      }
    ]
  },
  {
    path: '/screenRecord',
    element: <ScreenRecord />
  }
]

const Router = () => {
  const element = useRoutes(routeList)
  return (
    <>
      <ScrollToTop />
      {element}
    </>
  )
}
export default Router
