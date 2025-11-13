import { Home } from 'lucide-react'
import { Button } from '../ui/button'
import { useNavigate } from 'react-router-dom'

const GoHome = (): React.JSX.Element => {
  const navigate = useNavigate()
  const go = (): void => {
    navigate('/')
  }
  return (
    <Button onClick={go} size="sm" variant="secondary">
      <Home className="size-4" />
      首页
    </Button>
  )
}

export default GoHome
