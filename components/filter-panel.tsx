"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/lib/context/tenant-context"
import type { Tag, TagDimension } from "@/lib/types/database"

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  onApplyFilters: (filters: Record<string, string[]>) => void // dimension_key -> tag_ids[]
  showCategoryFilter?: boolean
}

export function FilterPanel({ isOpen, onClose, onApplyFilters, showCategoryFilter = true }: FilterPanelProps) {
  const { tenant } = useTenant()
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [tagsByDimension, setTagsByDimension] = useState<Record<string, Tag[]>>({})
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({}) // dimension_key -> tag_ids[]

  useEffect(() => {
    if (isOpen) {
      loadDimensionsAndTags()
    }
  }, [isOpen, tenant])

  const loadDimensionsAndTags = async () => {
    const supabase = createClient()
    
    // Load dimensions
    const { data: dimensionsData } = await supabase
      .from("tag_dimensions")
      .select("*")
      .order("display_order", { ascending: true })

    if (!dimensionsData) return
    setDimensions(dimensionsData)

    // Load tags for each dimension
    const tagsMap: Record<string, Tag[]> = {}
    
    for (const dimension of dimensionsData) {
      // Get parent tag if hierarchical
      let parentTagId: string | null = null
      if (dimension.is_hierarchical) {
        const { data: parentTag } = await supabase
          .from("tags")
          .select("id")
          .eq("dimension_key", dimension.dimension_key)
          .is("parent_id", null)
          .or(`client_id.eq.${tenant.id},client_id.is.null`)
          .maybeSingle()
        
        parentTagId = parentTag?.id || null
      }

      // Get tags for this dimension
      const query = supabase
        .from("tags")
        .select("id, dimension_key, label, slug, parent_id")
        .eq("dimension_key", dimension.dimension_key)
        .or(`client_id.eq.${tenant.id},client_id.is.null`)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true })

      if (dimension.is_hierarchical && parentTagId) {
        query.eq("parent_id", parentTagId)
      } else if (dimension.is_hierarchical) {
        query.is("parent_id", null)
      }

      const { data: tags } = await query
      if (tags) {
        tagsMap[dimension.dimension_key] = tags
      }
    }

    setTagsByDimension(tagsMap)
  }

  const toggleTag = (dimensionKey: string, tagId: string) => {
    setSelectedTags((prev) => {
      const current = prev[dimensionKey] || []
      const dimension = dimensions.find((d) => d.dimension_key === dimensionKey)
      const allowsMultiple = dimension?.allows_multiple ?? true

      if (allowsMultiple) {
        // Multi-select: toggle
        return {
          ...prev,
          [dimensionKey]: current.includes(tagId)
            ? current.filter((id) => id !== tagId)
            : [...current, tagId],
        }
      } else {
        // Single-select: replace
        return {
          ...prev,
          [dimensionKey]: current.includes(tagId) ? [] : [tagId],
        }
      }
    })
  }

  const handleApply = () => {
    onApplyFilters(selectedTags)
  }

  const handleClear = () => {
    setSelectedTags({})
  }

  // Filter dimensions to show (exclude file_type from manual filtering, it's auto-assigned)
  // Also exclude content_type as it overlaps with usage
  const filterableDimensions = dimensions.filter(
    (d) => (d.dimension_key !== "file_type" || showCategoryFilter) && d.dimension_key !== "content_type"
  )

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 cursor-pointer" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white shadow-xl" suppressHydrationWarning>
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-semibold">Filter</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {filterableDimensions.map((dimension) => {
            const tags = tagsByDimension[dimension.dimension_key] || []
            const selected = selectedTags[dimension.dimension_key] || []

            if (tags.length === 0) return null

            return (
              <div key={dimension.dimension_key} className="space-y-3">
                <Label className="text-base font-medium">{dimension.label}</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(dimension.dimension_key, tag.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        selected.includes(tag.id)
                          ? "border-[#DF475C] bg-[#DF475C] text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t bg-white p-6">
          <Button variant="outline" onClick={handleClear} className="flex-1 bg-transparent">
            Clear
          </Button>
          <Button onClick={handleApply} className="flex-1 bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">
            Apply filters
          </Button>
        </div>
      </div>
    </>
  )
}
