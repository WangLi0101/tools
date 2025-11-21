import Tool from '@/components/common/tool'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="flex-1 flex flex-col h-full bg-muted/30">
        <Tool />
        <main className="flex-1 overflow-y-auto p-3">
          <div className=" animate-in fade-in slide-in-from-bottom-4 p-4 duration-500 rounded-2xl bg-muted/50">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
