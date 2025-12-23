"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import { TagBadgeSelector } from "@/components/tag-badge-selector"
import type { Tag, TagDimension } from "@/lib/types/database"

interface HierarchicalTagSelectorProps {
  dimension: TagDimension
  selectedTagId: string | null
  onSelect: (tagId: string | null) => void
  clientId: string
  userId: string | null
  required?: boolean
  className?: string
}

export function HierarchicalTagSelector({
  dimension,
  selectedTagId,
  onSelect,
  clientId,
  userId,
  required = false,
  className = "",
}: HierarchicalTagSelectorProps) {
  const [parentTag, setParentTag] = useState<Tag | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (dimension.is_hierarchical) {
      loadParentTag()
    }
  }, [dimension, clientId])

  const loadParentTag = async () => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("dimension_key", dimension.dimension_key)
        .is("parent_id", null)
        .or(`client_id.eq.${clientId},client_id.is.null`)
        .single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned, which is fine
        console.error("Error loading parent tag:", error)
      } else if (data) {
        setParentTag(data)
      }
    } catch (error) {
      console.error("Error loading parent tag:", error)
    }
  }

  const handleCreateTag = async (label: string): Promise<string | null> => {
    try {
      // Create slug from label
      const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

      // Check if tag already exists (shouldn't happen due to UI, but double-check)
      const { data: existing } = await supabase
        .from("tags")
        .select("id")
        .eq("dimension_key", dimension.dimension_key)
        .eq("slug", slug)
        .or(`client_id.eq.${clientId},client_id.is.null`)
        .maybeSingle()

      if (existing) {
        return existing.id
      }

      // Get parent tag ID if hierarchical
      const parentId = dimension.is_hierarchical && parentTag ? parentTag.id : null

      // Create new tag
      const { data: newTag, error } = await supabase
        .from("tags")
        .insert({
          client_id: clientId,
          dimension_key: dimension.dimension_key,
          parent_id: parentId,
          label: label.trim(),
          slug,
          is_system: false,
          sort_order: 0,
          created_by: userId,
        })
        .select("id")
        .single()

      if (error) {
        console.error("Error creating tag:", error)
        return null
      }

      return newTag.id
    } catch (error) {
      console.error("Error creating tag:", error)
      return null
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <Label className="text-sm font-medium text-gray-900">
            {dimension.label}
            {!required && <span className="ml-2 text-xs font-normal text-gray-500">(Optional)</span>}
          </Label>
          {dimension.is_hierarchical && (
            <p className="mt-1 text-xs text-gray-500">
              {dimension.dimension_key === 'campaign' && 'Optional - helps organize assets into collections'}
              {dimension.dimension_key === 'brand_assets' && 'Optional - tag brand-related assets like logos, colors, or brand guidelines'}
              {dimension.dimension_key === 'department' && 'Optional - assign to departments'}
            </p>
          )}
        </div>
      </div>
      <TagBadgeSelector
        dimension={dimension}
        selectedTagId={selectedTagId}
        onSelect={onSelect}
        onCreate={dimension.allow_user_creation ? handleCreateTag : undefined}
        clientId={clientId}
        userId={userId}
      />
    </div>
  )
}

