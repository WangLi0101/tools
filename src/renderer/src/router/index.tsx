import { createHashRouter } from 'react-router-dom'
import HomePage from '@/views/home'
import FileTransformPage from '@/views/fileTransform'
import VideoPage from '@/views/fileTransform/video/page'
import ImagePage from '@/views/fileTransform/image/page'

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
      }
    ]
  }
])
