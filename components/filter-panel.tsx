"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { X, Loader2 } from "lucide-react"
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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load data when component mounts or tenant changes, not just when opened
    if (dimensions.length === 0) {
      loadDimensionsAndTags()
    }
  }, [tenant])

  const loadDimensionsAndTags = async () => {
    setIsLoading(true)
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
    setIsLoading(false)
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

  // Get default open accordions (campaign and brand_assets)
  const getDefaultOpenAccordions = () => {
    const defaultOpen: string[] = []
    filterableDimensions.forEach((dim) => {
      if (dim.dimension_key === 'campaign' || dim.dimension_key === 'brand_assets') {
        defaultOpen.push(dim.dimension_key)
      }
    })
    // If no campaign or brand_assets, open first one
    if (defaultOpen.length === 0 && filterableDimensions.length > 0) {
      defaultOpen.push(filterableDimensions[0].dimension_key)
    }
    return defaultOpen
  }

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 bg-black/20 cursor-pointer transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      <div 
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-md p-6 transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`} 
        suppressHydrationWarning
      >
        <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white">
          <div className="flex items-center justify-between border-b p-6">
            <h2 className="text-xl font-semibold">Filter</h2>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filterableDimensions.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                No filters available
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={getDefaultOpenAccordions()} className="space-y-2">
                {filterableDimensions.map((dimension) => {
                  const tags = tagsByDimension[dimension.dimension_key] || []
                  const selected = selectedTags[dimension.dimension_key] || []

                  if (tags.length === 0) return null

                  return (
                    <AccordionItem key={dimension.dimension_key} value={dimension.dimension_key} className="border-b border-gray-200">
                      <AccordionTrigger className="py-4 text-base font-medium hover:no-underline">
                        {dimension.label}
                        {selected.length > 0 && (
                          <span className="ml-2 rounded-full bg-[#DF475C] px-2 py-0.5 text-xs text-white">
                            {selected.length}
                          </span>
                        )}
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
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
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            )}
          </div>

          <div className="flex gap-3 border-t bg-white p-6 rounded-b-3xl">
            <Button variant="outline" onClick={handleClear} className="flex-1 bg-transparent">
              Clear
            </Button>
            <Button onClick={handleApply} className="flex-1 bg-[#DF475C] hover:bg-[#C82333]">
              Apply filters
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
