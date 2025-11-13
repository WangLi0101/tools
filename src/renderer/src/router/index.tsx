import { createHashRouter } from 'react-router-dom'
import ImagePage from '../views/image'
export const router = createHashRouter([
  {
    path: '/',
    element: <ImagePage />
  }
])
