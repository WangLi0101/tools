import { useSyncExternalStore } from 'react'

export const useStorage = <T>(key: string, initialValue: T) => {
  const setValue = (value: T) => {
    try {
      const res = typeof value === 'object' ? JSON.stringify(value) : value
      localStorage.setItem(key, res as string)
    } catch {}
    window.dispatchEvent(new Event('storage'))
  }

  const subscribe = (callback: () => void) => {
    window.addEventListener('storage', callback)
    return () => window.removeEventListener('storage', callback)
  }

  const getSnapshot = (): T => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initialValue
      if (raw === 'true') return true as unknown as T
      if (raw === 'false') return false as unknown as T
      if (raw === '1') return true as unknown as T
      if (raw === '0') return false as unknown as T
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    } catch {
      return initialValue
    }
  }

  const res = useSyncExternalStore<T>(subscribe, getSnapshot)

  return [res, setValue] as const
}
