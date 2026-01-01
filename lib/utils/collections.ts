"use client"

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
    const dimensionCollections = await Promise.all(tags.map(async (tag: any) => {
        const assetIds = tagAssetMap.get(tag.id) || []
        
        
        // Fetch assets directly from database to ensure we get all assets for this tag
        // This ensures we get assets even if they're not in allAssets
        let tagAssets: any[] = []
        
        if (assetIds.length > 0) {
          const { data: fetchedAssets, error: fetchError } = await supabase
            .from("assets")
            .select("id, title, storage_path, mime_type, created_at, file_size")
            .eq("client_id", clientId)
            .in("id", assetIds)
            .eq("status", "active")
          
          
          tagAssets = fetchedAssets || []
        }
        
        const videoAssets = tagAssets.filter((a: any) => a.mime_type?.startsWith("video/"))
        

        // Sort assets to prioritize videos and images for preview (but keep original order as fallback)
        // This ensures videos are included in preview if they exist
        const sortedForPreview = [...tagAssets].sort((a: any, b: any) => {
          const aIsVideo = a.mime_type?.startsWith("video/")
          const bIsVideo = b.mime_type?.startsWith("video/")
          if (aIsVideo && !bIsVideo) return -1
          if (!aIsVideo && bIsVideo) return 1
          return 0
        })

        const previewAssets = sortedForPreview.slice(0, 4).map((asset: any) => {
          // Ensure all required fields are present
          if (!asset || !asset.id || !asset.storage_path || !asset.mime_type) {
            return null
          }
          return {
            id: asset.id,
            title: asset.title || '',
            storage_path: asset.storage_path,
            mime_type: asset.mime_type
          }
        }).filter((a): a is { id: string; title: string; storage_path: string; mime_type: string } => a !== null) // Filter out any null entries

        return {
          id: tag.id,
          label: tag.label,
          slug: tag.slug,
          assetCount: tagAssets.length,
          previewAssets,
        }
      }))

    // Filter out collections with no assets
    return dimensionCollections.filter((c: any) => c.assetCount > 0)
  })

  // Wait for all collections to load
  const dimensionCollectionsResults = await Promise.all(collectionPromises)
  return dimensionCollectionsResults.flat()
}

