import { HashRouter } from 'react-router-dom'
import Router from './router/index'
import { Toaster } from '@/components/ui/sonner'
import Tool from './components/common/tool'
import { ThemeProvider } from 'next-themes'
function App(): React.JSX.Element {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="h-screen flex flex-col overflow-auto bg-background">
        <Tool />
        <div className="flex-1 overflow-auto p-3">
          <div className="min-h-full bg-card border border-input rounded-md">
            <HashRouter>
              <Router />
            </HashRouter>
          </div>
        </div>
        <Toaster closeButton richColors />
      </div>
    </ThemeProvider>
  )
}

export default App
