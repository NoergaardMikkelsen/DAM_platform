import { useTenant } from "@/lib/context/tenant-context"

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useLocalStorageCache(prefix: string = 'cache') {
  const { tenant } = useTenant()

  const getCacheKey = (key: string) => {
    if (!tenant?.id) return null
    return `${prefix}_${tenant.id}_${key}`
  }

  const getCachedData = <T,>(key: string): T | null => {
    if (typeof window === 'undefined') return null
    if (!tenant?.id) return null // Guard against tenant not being ready
    try {
      const cacheKey = getCacheKey(key)
      if (!cacheKey) return null
      const cached = localStorage.getItem(cacheKey)
      if (!cached) return null
      
      // Use performance API to measure parse time for large objects
      const parseStart = performance.now()
      const { data, timestamp } = JSON.parse(cached)
      const parseTime = performance.now() - parseStart
      
      // Log slow parses for debugging (only in dev)
      if (process.env.NODE_ENV === 'development' && parseTime > 50) {
        console.log(`[CACHE] Slow parse for ${key}: ${parseTime.toFixed(2)}ms, size: ${(cached.length / 1024).toFixed(2)}KB`)
      }
      
      const age = Date.now() - timestamp
      
      if (age > CACHE_DURATION) {
        localStorage.removeItem(cacheKey)
        return null
      }
      
      return data
    } catch (error) {
      // If parsing fails (e.g., corrupted data), remove the cache entry
      console.error(`[CACHE] Error parsing cache for ${key}:`, error)
      try {
        localStorage.removeItem(getCacheKey(key))
      } catch {
        // Ignore removal errors
      }
      return null
    }
  }

  const setCachedData = <T,>(key: string, data: T) => {
    if (typeof window === 'undefined') return
    if (!tenant?.id) return // Guard against tenant not being ready
    try {
      const cacheKey = getCacheKey(key)
      if (!cacheKey) return
      const cacheValue = JSON.stringify({
        data,
        timestamp: Date.now()
      })
      
      // Check size before storing (localStorage limit is typically 5-10MB per origin)
      const sizeInMB = new Blob([cacheValue]).size / 1024 / 1024
      if (sizeInMB > 5) {
        console.warn(`[CACHE] Cache entry for ${key} is large: ${sizeInMB.toFixed(2)}MB. Consider reducing data size.`)
        // Still try to store, but warn
      }
      
      localStorage.setItem(cacheKey, cacheValue)
      
      // Log in dev mode for debugging
      if (process.env.NODE_ENV === 'development') {
        const stringifyTime = performance.now()
        console.log(`[CACHE] Cached ${key}: ${sizeInMB.toFixed(2)}MB`)
      }
    } catch (error: any) {
      // Handle quota exceeded errors gracefully
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        console.warn(`[CACHE] Storage quota exceeded for ${key}. Clearing old cache entries.`)
        // Try to clear old entries and retry
        try {
          // Clear expired entries
          const keys = Object.keys(localStorage)
          keys.forEach(k => {
            if (k.startsWith('assets_cache_')) {
              try {
                const item = localStorage.getItem(k)
                if (item) {
                  const { timestamp } = JSON.parse(item)
                  if (Date.now() - timestamp > CACHE_DURATION) {
                    localStorage.removeItem(k)
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }
          })
        } catch {
          // Ignore cleanup errors
        }
      } else {
        console.error(`[CACHE] Error setting cache for ${key}:`, error)
      }
    }
  }

  const invalidateCache = (key: string) => {
    if (typeof window === 'undefined') return
    if (!tenant?.id) return // Guard against tenant not being ready
    const cacheKey = getCacheKey(key)
    if (!cacheKey) return
    localStorage.removeItem(cacheKey)
  }

  return {
    getCachedData,
    setCachedData,
    invalidateCache
  }
}

