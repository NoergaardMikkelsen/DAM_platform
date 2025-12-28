import { useTenant } from "@/lib/context/tenant-context"

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useLocalStorageCache(prefix: string = 'cache') {
  const { tenant } = useTenant()

  const getCacheKey = (key: string) => `${prefix}_${tenant.id}_${key}`

  const getCachedData = <T,>(key: string): T | null => {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(getCacheKey(key))
      if (!cached) return null
      
      const { data, timestamp } = JSON.parse(cached)
      const age = Date.now() - timestamp
      
      if (age > CACHE_DURATION) {
        localStorage.removeItem(getCacheKey(key))
        return null
      }
      
      return data
    } catch {
      return null
    }
  }

  const setCachedData = <T,>(key: string, data: T) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(getCacheKey(key), JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch {
      // Ignore storage errors
    }
  }

  const invalidateCache = (key: string) => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(getCacheKey(key))
  }

  return {
    getCachedData,
    setCachedData,
    invalidateCache
  }
}

