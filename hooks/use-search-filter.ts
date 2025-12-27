import { useState, useEffect, useMemo } from "react"

export interface UseSearchFilterOptions<T> {
  /**
   * The items to filter
   */
  items: T[]
  /**
   * Function to extract searchable text from an item
   * Can return a string or array of strings to search in
   */
  searchFields: (item: T) => string | string[]
  /**
   * Optional custom filter function
   * If provided, this will be used instead of the default search
   */
  customFilter?: (item: T, query: string) => boolean
  /**
   * Debounce delay in milliseconds (default: 0 = no debounce)
   */
  debounceMs?: number
  /**
   * Initial search query
   */
  initialQuery?: string
}

export interface UseSearchFilterReturn<T> {
  /**
   * Current search query
   */
  searchQuery: string
  /**
   * Function to update search query
   */
  setSearchQuery: (query: string) => void
  /**
   * Filtered items based on search query
   */
  filteredItems: T[]
  /**
   * Clear the search query
   */
  clearSearch: () => void
}

/**
 * Hook for handling search/filter functionality with optional debouncing
 * 
 * @example
 * ```tsx
 * const { searchQuery, setSearchQuery, filteredItems } = useSearchFilter({
 *   items: users,
 *   searchFields: (user) => [user.name, user.email],
 * })
 * ```
 */
export function useSearchFilter<T>({
  items,
  searchFields,
  customFilter,
  debounceMs = 0,
  initialQuery = "",
}: UseSearchFilterOptions<T>): UseSearchFilterReturn<T> {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)

  // Debounce search query if debounceMs > 0
  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedQuery(searchQuery)
      return
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [searchQuery, debounceMs])

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return items
    }

    const query = debouncedQuery.toLowerCase().trim()

    if (customFilter) {
      return items.filter((item) => customFilter(item, query))
    }

    return items.filter((item) => {
      const fields = searchFields(item)
      const searchableText = Array.isArray(fields)
        ? fields.join(" ").toLowerCase()
        : fields.toLowerCase()

      return searchableText.includes(query)
    })
  }, [items, debouncedQuery, searchFields, customFilter])

  const clearSearch = () => {
    setSearchQuery("")
    setDebouncedQuery("")
  }

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    clearSearch,
  }
}

