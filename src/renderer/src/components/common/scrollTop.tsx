import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    const candidates = document.querySelectorAll(
      '.overflow-auto, .overflow-y-auto, .overflow-scroll, .overflow-y-scroll'
    )
    candidates.forEach((el) => {
      const node = el as HTMLElement
      if (node && node.scrollHeight > node.clientHeight) {
        node.scrollTop = 0
      }
    })
  }, [pathname])
  return null
}
