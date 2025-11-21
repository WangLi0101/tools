import { HashRouter } from 'react-router-dom'
import Router from './router/index'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'
import { AppLayout } from './components/layout/app-layout'

function App(): React.JSX.Element {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <HashRouter>
        <AppLayout>
          <Router />
        </AppLayout>
        <Toaster closeButton richColors />
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
