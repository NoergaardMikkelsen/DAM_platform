/**
 * Tag creation utilities
 * Provides consolidated tag creation logic across the application
 */

import type { TagDimension } from "@/lib/types/database"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateSlug } from "./slug"
import { getParentTagId } from "./tags"

/**
 * Determine tag_type based on dimension_key (for backward compatibility)
 * @param dimensionKey - The dimension key
 * @returns The tag type string
 */
export function determineTagType(dimensionKey: string): string {
  const typeMap: Record<string, string> = {
    campaign: "category",
    brand_assets: "category",
    visual_style: "visual_style",
    usage: "usage",
    file_type: "file_type",
  }
  return typeMap[dimensionKey] || "description"
}

/**
 * Options for creating a tag
 */
export interface CreateTagOptions {
  /** The tag label */
  label: string
  /** The dimension key */
  dimensionKey: string
  /** The client ID */
  clientId: string
  /** The user ID creating the tag */
  userId: string
  /** The tag dimension object */
  dimension: TagDimension
  /** Optional parent tag ID (for hierarchical tags) */
  parentId?: string | null
  /** Optional sort order (default: 0) */
  sortOrder?: number
}

/**
 * Create a new tag in the database
 * @param supabase - Supabase client instance
 * @param options - Tag creation options
 * @returns The created tag ID, or null if creation failed or tag already exists
 */
export async function createTag(
  supabase: SupabaseClient,
  options: CreateTagOptions
): Promise<string | null> {
  const {
    label,
    dimensionKey,
    clientId,
    userId,
    dimension,
    parentId,
    sortOrder = 0,
  } = options

  // Check if user creation is allowed
  if (!dimension.allow_user_creation) {
    return null
  }

  // Generate slug from label
  const slug = generateSlug(label.trim())

  // Get parent tag ID if hierarchical (if not provided)
  let finalParentId = parentId
  if (dimension.is_hierarchical && finalParentId === undefined) {
    finalParentId = await getParentTagId(supabase, dimension, clientId)
  }

  // Check if tag already exists before creating
  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("dimension_key", dimensionKey)
    .eq("slug", slug)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .maybeSingle()

  if (existing) {
    return existing.id
  }

  // Determine tag_type for backward compatibility
  const tagType = determineTagType(dimensionKey)

  // Determine if this is a parent tag or subtag
  // Parent tags (parent_id IS NULL) are system tags (is_system = true, client_id = NULL)
  // Subtags (parent_id IS NOT NULL) are client-specific (is_system = false, client_id = clientId)
  const isParentTag = finalParentId === null || finalParentId === undefined
  const isSystemTag = isParentTag
  const tagClientId = isParentTag ? null : clientId

  // Insert new tag
  const { data, error } = await supabase
    .from("tags")
    .insert({
      client_id: tagClientId,
      dimension_key: dimensionKey,
      parent_id: finalParentId || null,
      label: label.trim(),
      slug,
      is_system: isSystemTag,
      sort_order: sortOrder,
      created_by: userId,
      tag_type: tagType,
    })
    .select("id")
    .single()

  if (error) {
    return null
  }

  return data?.id || null
}

/**
 * Create a tag creation handler function for use in components
 * This returns a function that can be passed to onCreate callbacks
 * @param supabase - Supabase client instance
 * @param dimension - The tag dimension
 * @param clientId - The client ID
 * @param userId - The user ID
 * @returns A function that creates a tag and returns its ID, or null if creation is not allowed
 */
export function createTagHandler(
  supabase: SupabaseClient,
  dimension: TagDimension,
  clientId: string,
  userId: string
): ((label: string) => Promise<string | null>) | undefined {
  if (!dimension.allow_user_creation) {
    return undefined
  }

  return async (label: string): Promise<string | null> => {
    return createTag(supabase, {
      label,
      dimensionKey: dimension.dimension_key,
      clientId,
      userId,
      dimension,
    })
  }
}

/**
 * Options for creating a system tag (visible across all tenants)
 */
export interface CreateSystemTagOptions {
  /** The tag label */
  label: string
  /** The dimension key */
  dimensionKey: string
  /** The user ID creating the tag */
  userId: string
  /** The tag dimension object */
  dimension: TagDimension
  /** Optional parent tag ID (for hierarchical tags) */
  parentId?: string | null
  /** Optional sort order (default: 0) */
  sortOrder?: number
}

/**
 * Create a new system tag (client_id = NULL, is_system = true)
 * System tags are visible across all tenants
 * @param supabase - Supabase client instance
 * @param options - System tag creation options
 * @returns The created tag ID, or null if creation failed or tag already exists
 */
export async function createSystemTag(
  supabase: SupabaseClient,
  options: CreateSystemTagOptions
): Promise<string | null> {
  const {
    label,
    dimensionKey,
    userId,
    dimension,
    parentId,
    sortOrder = 0,
  } = options

  // Generate slug from label
  const slug = generateSlug(label.trim())

  // Get parent tag ID if hierarchical (if not provided)
  let finalParentId = parentId
  if (dimension.is_hierarchical && finalParentId === undefined) {
    // For system tags, parent should also be a system tag (client_id IS NULL)
    const { data: parentTag } = await supabase
      .from("tags")
      .select("id")
      .eq("dimension_key", dimensionKey)
      .is("parent_id", null)
      .is("client_id", null)
      .eq("is_system", true)
      .maybeSingle()
    
    finalParentId = parentTag?.id || null
  }

  // Check if tag already exists before creating (check system tags only)
  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("dimension_key", dimensionKey)
    .eq("slug", slug)
    .is("client_id", null)
    .eq("is_system", true)
    .maybeSingle()

  if (existing) {
    return existing.id
  }

  // Determine tag_type for backward compatibility
  const tagType = determineTagType(dimensionKey)

  // System tags always have client_id = NULL and is_system = true
  // Parent tags (parent_id IS NULL) are system tags
  // Subtags (parent_id IS NOT NULL) can also be system tags if created by superadmin
  const isParentTag = finalParentId === null || finalParentId === undefined

  // Insert new system tag
  const { data, error } = await supabase
    .from("tags")
    .insert({
      client_id: null, // System tags have no client_id
      dimension_key: dimensionKey,
      parent_id: finalParentId || null,
      label: label.trim(),
      slug,
      is_system: true, // Always true for system tags
      sort_order: sortOrder,
      created_by: userId,
      tag_type: tagType,
    })
    .select("id")
    .single()

  if (error) {
    return null
  }

  return data?.id || null
}

