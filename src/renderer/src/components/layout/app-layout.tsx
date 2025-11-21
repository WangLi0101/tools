
import Tool from '@/components/common/tool'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col h-full bg-muted/30">
        <Tool />
        <main className="flex-1 overflow-y-auto p-4">
          <div className=" animate-in fade-in slide-in-from-bottom-4 duration-500 bg-background">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
