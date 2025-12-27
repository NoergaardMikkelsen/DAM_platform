import type { SupabaseClient } from "@supabase/supabase-js"
import { getParentTagId } from "./tags"
import type { TagDimension } from "@/lib/types/database"

export interface Collection {
  id: string
  label: string
  slug: string
  assetCount: number
  previewAssets: Array<{
    id: string
    title: string
    storage_path: string
    mime_type: string
    thumbnail_path?: string | null
  }>
}

/**
 * Load collections from dimensions
 * Creates collections based on tags that generate collections
 */
export async function loadCollectionsFromDimensions(
  supabase: SupabaseClient,
  dimensions: TagDimension[],
  clientId: string,
  allAssets?: Array<{
    id: string
    title: string
    storage_path: string
    mime_type: string
    created_at: string
    file_size: number
    current_version?: {
      thumbnail_path: string | null
    }
  }>
): Promise<Collection[]> {
  const collectionPromises = dimensions.map(async (dimension) => {
    // Get parent tag if hierarchical
    const parentTagId = await getParentTagId(supabase, dimension, clientId)

    // Get tags for this dimension
    // For hierarchical dimensions, only get child tags (exclude parent tags)
    const query = supabase
      .from("tags")
      .select("id, label, slug")
      .eq("dimension_key", dimension.dimension_key)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .order("sort_order", { ascending: true })

    if (dimension.is_hierarchical) {
      // For hierarchical dimensions, always exclude parent tags (parent_id IS NULL)
      // Only show child tags
      if (parentTagId) {
        // If parent tag exists, only show its children
        query.eq("parent_id", parentTagId)
      } else {
        // If no parent tag exists, show all child tags (parent_id IS NOT NULL)
        query.not("parent_id", "is", null)
      }
    }

    const { data: tags } = await query

    if (!tags || tags.length === 0) return []

    // Get asset-tag relationships for this dimension
    const { data: assetTags } = await supabase
      .from("asset_tags")
      .select("asset_id, tag_id")
      .in("tag_id", tags.map((t: any) => t.id))

    // Build map of tag_id -> asset_ids
    const tagAssetMap = new Map<string, string[]>()
    assetTags?.forEach((at: any) => {
      const current = tagAssetMap.get(at.tag_id) || []
      tagAssetMap.set(at.tag_id, [...current, at.asset_id])
    })

    // Create collections for each tag
    const dimensionCollections = tags
      .map((tag: any) => {
        const assetIds = tagAssetMap.get(tag.id) || []
        const tagAssets = allAssets?.filter((a: any) => assetIds.includes(a.id)) || []

        return {
          id: tag.id,
          label: tag.label,
          slug: tag.slug,
          assetCount: tagAssets.length,
          previewAssets: tagAssets.slice(0, 4).map((asset: any) => ({
            id: asset.id,
            title: asset.title,
            storage_path: asset.storage_path,
            mime_type: asset.mime_type,
            thumbnail_path: asset.current_version?.thumbnail_path || null
          })),
        }
      })
      .filter((c: any) => c.assetCount > 0)

    return dimensionCollections
  })

  // Wait for all collections to load
  const dimensionCollectionsResults = await Promise.all(collectionPromises)
  return dimensionCollectionsResults.flat()
}

