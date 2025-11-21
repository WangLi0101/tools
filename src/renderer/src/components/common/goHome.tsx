import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface GoHomeProps {
  className?: string
}

const GoHome = ({ className }: GoHomeProps): React.JSX.Element => {
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('shrink-0', className)}
      onClick={() => navigate('/')}
      title="返回首页"
    >
      <Home className="size-5" />
    </Button>
  )
}

export default GoHome
