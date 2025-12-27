import type { Tag, TagDimension } from "@/lib/types/database"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Fuzzy match function for finding similar tags
 * Checks if two strings are similar enough to be considered a match
 */
export function fuzzyMatch(str1: string, str2: string): boolean {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  // Exact match
  if (s1 === s2) return true
  
  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return true
  
  // Levenshtein-like: if strings are similar length and share most characters
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length < 3) return false // Too short for fuzzy matching
  
  // Check if shorter string is mostly contained in longer
  let matches = 0
  for (const char of shorter) {
    if (longer.includes(char)) matches++
  }
  
  return matches / shorter.length > 0.7 // 70% character match
}

/**
 * Get parent tag ID for a hierarchical dimension
 */
export async function getParentTagId(
  supabase: SupabaseClient,
  dimension: TagDimension,
  clientId: string
): Promise<string | null> {
  if (!dimension.is_hierarchical) return null

  const { data: parentTag } = await supabase
    .from("tags")
    .select("id")
    .eq("dimension_key", dimension.dimension_key)
    .is("parent_id", null)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .maybeSingle()

  return parentTag?.id || null
}

/**
 * Load tags for a dimension, handling hierarchical structure
 */
export async function loadTagsForDimension(
  supabase: SupabaseClient,
  dimension: TagDimension,
  clientId: string,
  options?: {
    includeAssetCounts?: boolean
    excludeParentTags?: boolean
  }
): Promise<Tag[]> {
  const { includeAssetCounts = false, excludeParentTags = true } = options || {}

  // Get parent tag for hierarchical dimensions
  const parentTagId = await getParentTagId(supabase, dimension, clientId)

  // Build query - use conditional select
  let query
  if (includeAssetCounts) {
    query = supabase
      .from("tags")
      .select(`*, asset_tags(count)`)
  } else {
    query = supabase
      .from("tags")
      .select(`*`)
  }

  query = query
    .eq("dimension_key", dimension.dimension_key)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })

  // Handle hierarchical dimensions
  if (dimension.is_hierarchical) {
    if (parentTagId) {
      // Show only child tags of the parent
      query = query.eq("parent_id", parentTagId)
    } else if (excludeParentTags) {
      // Exclude parent tags (where parent_id IS NULL)
      query = query.not("parent_id", "is", null)
    }
  }

  const { data: tags, error } = await query

  if (error) {
    console.error("Error loading tags:", error)
    return []
  }

  // Add asset count to tags if requested
  if (includeAssetCounts && tags) {
    return tags.map((tag: any) => ({
      ...tag,
      asset_count: tag.asset_tags?.[0]?.count || 0,
    })) as Tag[]
  }

  return (tags || []) as Tag[]
}

