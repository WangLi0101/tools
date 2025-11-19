import { HashRouter } from 'react-router-dom'
import Router from './router/index'
import { Toaster } from '@/components/ui/sonner'
import Tool from './components/common/tool'
import { ThemeProvider } from 'next-themes'
function App(): React.JSX.Element {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen flex flex-col bg-background">
        <Tool />
        <div className="flex-1 overflow-auto px-4 sm:px-6 md:px-8 py-4">
          <div className="min-h-full max-w-screen-2xl mx-auto bg-card/95 backdrop-blur-sm border border-input rounded-2xl shadow-sm transition-colors">
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
