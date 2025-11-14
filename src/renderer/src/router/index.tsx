import { createHashRouter } from 'react-router-dom'
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

export const router = createHashRouter([
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
  }
])
