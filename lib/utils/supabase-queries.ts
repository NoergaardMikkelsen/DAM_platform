import { SupabaseClient } from "@supabase/supabase-js"

/**
 * Query builder helpers for consistent and efficient Supabase queries
 * 
 * These helpers ensure:
 * - Consistent query patterns across the codebase
 * - Efficient queries with proper filtering
 * - Type safety
 * - Reusable query builders
 */

/**
 * Convenience functions for common query patterns
 * These functions encapsulate common query patterns to ensure consistency
 */

/**
 * Get active assets for a client
 * Note: Supabase/PostgREST has a default limit of 1000 rows.
 * If you need more than 1000 assets, use getAllActiveAssetsForClient() instead.
 */
export async function getActiveAssetsForClient<T = any>(
  supabase: SupabaseClient,
  clientId: string,
  options?: {
    columns?: string | string[]
    orderBy?: "created_at" | "title"
    ascending?: boolean
    limit?: number
    range?: { from: number; to: number }
  }
) {
  const columns = options?.columns 
    ? (Array.isArray(options.columns) ? options.columns.join(", ") : options.columns)
    : "*"

  let query = supabase
    .from("assets")
    .select(columns)
    .eq("client_id", clientId)
    .eq("status", "active")

  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options?.ascending ?? false })
  }

  // Use range if provided, otherwise use limit
  if (options?.range) {
    query = query.range(options.range.from, options.range.to)
  } else if (options?.limit) {
    query = query.limit(options.limit)
  } else {
    // No limit specified - Supabase defaults to 1000
  }

  return await query as { data: T | null; error: any }
}

/**
 * Get ALL active assets for a client (handles pagination automatically)
 * This function fetches assets in batches to bypass Supabase's 1000 row limit
 */
export async function getAllActiveAssetsForClient<T = any>(
  supabase: SupabaseClient,
  clientId: string,
  options?: {
    columns?: string | string[]
    orderBy?: "created_at" | "title"
    ascending?: boolean
    batchSize?: number
  }
) {
  const columns = options?.columns 
    ? (Array.isArray(options.columns) ? options.columns.join(", ") : options.columns)
    : "*"

  const batchSize = options?.batchSize || 1000
  const allAssets: T[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const to = from + batchSize - 1

    let query = supabase
      .from("assets")
      .select(columns)
      .eq("client_id", clientId)
      .eq("status", "active")

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options?.ascending ?? false })
    }

    const { data, error } = await query.range(from, to) as { data: T[] | null; error: any }

    if (error) {
      console.error("Error fetching assets in batch:", error)
      return { data: null, error }
    }

    if (data && data.length > 0) {
      allAssets.push(...(data as T[]))
      const videoCount = (data as any[]).filter((a: any) => a.mime_type?.startsWith("video/")).length
      console.log(`[getAllActiveAssetsForClient] Fetched batch ${Math.floor(from / batchSize) + 1}: ${data.length} assets (${videoCount} videos) (total: ${allAssets.length})`)
      // If we got fewer results than batchSize, we've reached the end
      hasMore = data.length === batchSize
      from += batchSize
    } else {
      hasMore = false
    }
  }

  const totalVideos = (allAssets as any[]).filter((a: any) => a.mime_type?.startsWith("video/")).length
  console.log(`[getAllActiveAssetsForClient] Total assets fetched: ${allAssets.length} (${totalVideos} videos)`)

  return { data: allAssets, error: null } as { data: T[]; error: null }
}

/**
 * Get assets count for a client
 */
export async function getAssetsCountForClient(
  supabase: SupabaseClient,
  clientId: string,
  status: string = "active"
) {
  return await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", status) as { count: number | null; error: any }
}

/**
 * Get tags for a client (including system tags where client_id is null)
 */
export async function getTagsForClient<T = any>(
  supabase: SupabaseClient,
  clientId: string,
  options?: {
    columns?: string | string[]
    dimensionKey?: string
    excludeParentTags?: boolean
    parentId?: string | null
    orderBy?: "sort" | "dimension"
  }
) {
  const columns = options?.columns 
    ? (Array.isArray(options.columns) ? options.columns.join(", ") : options.columns)
    : "*"

  let query = supabase
    .from("tags")
    .select(columns)
    .or(`client_id.eq.${clientId},client_id.is.null`)

  if (options?.dimensionKey) {
    query = query.eq("dimension_key", options.dimensionKey)
  }

  if (options?.parentId !== undefined) {
    if (options.parentId === null) {
      query = query.is("parent_id", null)
    } else {
      query = query.eq("parent_id", options.parentId)
    }
  }

  if (options?.excludeParentTags) {
    query = query.not("parent_id", "is", null)
  }

  if (options?.orderBy === "sort") {
    query = query.order("sort_order", { ascending: true })
    query = query.order("label", { ascending: true })
  } else if (options?.orderBy === "dimension") {
    query = query.order("dimension_key")
    query = query.order("sort_order")
  }

  return await query as { data: T | null; error: any }
}

/**
 * Get tag dimensions that generate collections
 */
export async function getCollectionDimensions<T = any>(
  supabase: SupabaseClient
) {
  return await supabase
    .from("tag_dimensions")
    .select("*")
    .eq("generates_collection", true)
    .order("display_order", { ascending: true }) as { data: T | null; error: any }
}

/**
 * Get tag dimensions that allow user creation
 */
export async function getUserCreatableDimensions<T = any>(
  supabase: SupabaseClient
) {
  return await supabase
    .from("tag_dimensions")
    .select("*")
    .eq("allow_user_creation", true)
    .order("display_order", { ascending: true }) as { data: T | null; error: any }
}

/**
 * Get active client users for a client
 */
export async function getActiveClientUsers<T = any>(
  supabase: SupabaseClient,
  clientId: string,
  options?: {
    columns?: string | string[]
    userId?: string
  }
) {
  const columns = options?.columns 
    ? (Array.isArray(options.columns) ? options.columns.join(", ") : options.columns)
    : "*"

  let query = supabase
    .from("client_users")
    .select(columns)
    .eq("client_id", clientId)
    .eq("status", "active")

  if (options?.userId) {
    query = query.eq("user_id", options.userId)
  }

  return await query as { data: T | null; error: any }
}

/**
 * Get client users count for a client
 */
export async function getClientUsersCount(
  supabase: SupabaseClient,
  clientId: string,
  status: string = "active"
) {
  return await supabase
    .from("client_users")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", status) as { count: number | null; error: any }
}

/**
 * Get asset tags for an asset
 */
export async function getAssetTags<T = any>(
  supabase: SupabaseClient,
  assetId: string,
  options?: {
    includeTagData?: boolean
  }
) {
  const select = options?.includeTagData 
    ? "*, tags(*)" 
    : "*"

  return await supabase
    .from("asset_tags")
    .select(select)
    .eq("asset_id", assetId) as { data: T | null; error: any }
}

/**
 * Get asset tags for multiple assets
 */
export async function getAssetTagsForAssets<T = any>(
  supabase: SupabaseClient,
  assetIds: string[],
  options?: {
    includeTagData?: boolean
  }
) {
  if (assetIds.length === 0) {
    return { data: [] as T[], error: null }
  }

  const select = options?.includeTagData 
    ? "*, tags(*)" 
    : "*"

  return await supabase
    .from("asset_tags")
    .select(select)
    .in("asset_id", assetIds) as { data: T | null; error: any }
}
