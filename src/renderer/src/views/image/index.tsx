import { Button } from '@/components/ui/button'

const ImagePage = (): React.JSX.Element => {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Image Page</h1>
      <Button variant="default">验证 shadcn/ui 安装</Button>
      <Button variant="secondary">Secondary</Button>
    </div>
  )
}

export default ImagePage
