import { useState, useEffect, useMemo } from "react"

/**
 * Options for usePagination hook
 */
export interface UsePaginationOptions {
  /** Initial page number (default: 1) */
  initialPage?: number
  /** Initial items per page (default: 10) */
  initialItemsPerPage?: number
  /** Whether to calculate items per page based on viewport height (default: false) */
  calculateItemsPerPage?: boolean
  /** Fixed height overhead in pixels (for viewport calculation) */
  fixedHeight?: number
  /** Row/item height in pixels (for viewport calculation) */
  rowHeight?: number
  /** Minimum items per page (default: 3) */
  minItemsPerPage?: number
  /** Maximum items per page (default: undefined, no limit) */
  maxItemsPerPage?: number
}

/**
 * Return type for usePagination hook
 */
export interface UsePaginationReturn<T> {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Items per page */
  itemsPerPage: number
  /** Total number of pages */
  totalPages: number
  /** Paginated items for current page */
  paginatedItems: T[]
  /** Total number of items */
  totalItems: number
  /** Go to specific page */
  goToPage: (page: number) => void
  /** Go to next page */
  nextPage: () => void
  /** Go to previous page */
  prevPage: () => void
  /** Go to first page */
  firstPage: () => void
  /** Go to last page */
  lastPage: () => void
  /** Set items per page manually */
  setItemsPerPage: (items: number) => void
  /** Check if on first page */
  isFirstPage: boolean
  /** Check if on last page */
  isLastPage: boolean
}

/**
 * Pagination hook for handling pagination state and calculations
 * 
 * @param items - Array of items to paginate
 * @param options - Pagination options
 * @returns Pagination state and helper functions
 * 
 * @example
 * ```tsx
 * const { paginatedItems, currentPage, totalPages, nextPage, prevPage } = usePagination(
 *   filteredUsers,
 *   { calculateItemsPerPage: true, fixedHeight: 404, rowHeight: 60 }
 * )
 * ```
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    initialPage = 1,
    initialItemsPerPage = 10,
    calculateItemsPerPage = false,
    fixedHeight = 404, // Default: Header(80) + Search(50) + Tabs(50) + Table header(60) + Padding(64) + Pagination(60) + Margin(40)
    rowHeight = 60,
    minItemsPerPage = 3,
    maxItemsPerPage,
  } = options

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage)

  // Calculate items per page based on viewport height
  useEffect(() => {
    if (!calculateItemsPerPage) return

    const calculateItemsPerPageFromViewport = () => {
      if (typeof window === "undefined") return

      const availableHeight = window.innerHeight - fixedHeight
      const calculatedItems = Math.max(
        minItemsPerPage,
        Math.floor(availableHeight / rowHeight)
      )
      const finalItems = maxItemsPerPage
        ? Math.min(calculatedItems, maxItemsPerPage)
        : calculatedItems

      setItemsPerPage(finalItems)
    }

    calculateItemsPerPageFromViewport()
    window.addEventListener("resize", calculateItemsPerPageFromViewport)
    return () =>
      window.removeEventListener("resize", calculateItemsPerPageFromViewport)
  }, [
    calculateItemsPerPage,
    fixedHeight,
    rowHeight,
    minItemsPerPage,
    maxItemsPerPage,
  ])

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(1)
  }, [items.length])

  // Calculate pagination values
  const totalPages = useMemo(
    () => Math.ceil(items.length / itemsPerPage),
    [items.length, itemsPerPage]
  )

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return items.slice(startIndex, endIndex)
  }, [items, currentPage, itemsPerPage])

  // Navigation functions
  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const firstPage = () => {
    setCurrentPage(1)
  }

  const lastPage = () => {
    setCurrentPage(totalPages)
  }

  const isFirstPage = currentPage === 1
  const isLastPage = currentPage >= totalPages

  return {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems,
    totalItems: items.length,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setItemsPerPage,
    isFirstPage,
    isLastPage,
  }
}

