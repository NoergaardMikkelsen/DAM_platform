/**
 * Utility functions for sorting and filtering data
 */

export type SortOption = "newest" | "oldest" | "name" | "size"

export interface SortableItem {
  created_at?: string
  title?: string
  label?: string
  name?: string
  file_size?: number
  assetCount?: number
}

/**
 * Sort items by the specified option
 */
export function sortItems<T extends SortableItem>(
  items: T[],
  sortBy: SortOption
): T[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        // For collections: sort by assetCount descending (most assets first)
        // For assets: sort by created_at descending
        if (a.assetCount !== undefined && b.assetCount !== undefined) {
          return b.assetCount - a.assetCount
        }
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        return 0

      case "oldest":
        // For collections: sort by assetCount ascending (least assets first)
        // For assets: sort by created_at ascending
        if (a.assetCount !== undefined && b.assetCount !== undefined) {
          return a.assetCount - b.assetCount
        }
        if (a.created_at && b.created_at) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        return 0

      case "name":
        // Sort alphabetically by title or label
        const aName = a.title || a.label || a.name || ""
        const bName = b.title || b.label || b.name || ""
        return aName.localeCompare(bName)

      case "size":
        // Sort by file_size descending
        if (a.file_size !== undefined && b.file_size !== undefined) {
          return b.file_size - a.file_size
        }
        return 0

      default:
        return 0
    }
  })
}

/**
 * Filter items by search query
 */
export function filterBySearch<T extends SortableItem>(
  items: T[],
  searchQuery: string,
  searchFields: Array<keyof T> = ["title", "label", "name"]
): T[] {
  if (!searchQuery.trim()) return items

  const query = searchQuery.toLowerCase().trim()
  return items.filter((item) => {
    return searchFields.some((field) => {
      const value = item[field]
      if (typeof value === "string") {
        return value.toLowerCase().includes(query)
      }
      return false
    })
  })
}

/**
 * Sort order options for tags - user-friendly labels
 */
export const SORT_ORDER_OPTIONS = [
  { value: -2, label: "Highest priority" },
  { value: -1, label: "High priority" },
  { value: 0, label: "Normal" },
  { value: 1, label: "Low priority" },
  { value: 2, label: "Lowest priority" },
] as const

/**
 * Convert sort_order number to user-friendly label
 */
export function getSortOrderLabel(sortOrder: number): string {
  const option = SORT_ORDER_OPTIONS.find(opt => opt.value === sortOrder)
  return option?.label || "Normal"
}

/**
 * Convert user-friendly label to sort_order number
 */
export function getSortOrderValue(label: string): number {
  const option = SORT_ORDER_OPTIONS.find(opt => opt.label === label)
  return option?.value ?? 0
}

