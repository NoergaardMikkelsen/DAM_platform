import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { loadTagsForDimension } from "@/lib/utils/tags"
import type { Tag, TagDimension } from "@/lib/types/database"

interface UseTagsOptions {
  includeAssetCounts?: boolean
  excludeParentTags?: boolean
}

/**
 * Custom hook for loading tags for a dimension
 */
export function useTags(
  dimension: TagDimension | null,
  clientId: string | null,
  options?: UseTagsOptions
) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!dimension || !clientId) {
      setAvailableTags([])
      setIsLoading(false)
      return
    }

    const loadTags = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const tags = await loadTagsForDimension(supabase, dimension, clientId, options)
        setAvailableTags(tags)
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load tags")
        setError(error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTags()
  }, [dimension?.dimension_key, clientId, options?.includeAssetCounts, options?.excludeParentTags])

  return { availableTags, isLoading, error, reload: () => {
    if (dimension && clientId) {
      const loadTags = async () => {
        setIsLoading(true)
        setError(null)
        try {
          const supabase = createClient()
          const tags = await loadTagsForDimension(supabase, dimension, clientId, options)
          setAvailableTags(tags)
        } catch (err) {
          const error = err instanceof Error ? err : new Error("Failed to load tags")
          setError(error)
        } finally {
          setIsLoading(false)
        }
      }
      loadTags()
    }
  } }
}

