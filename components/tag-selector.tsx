"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Check, Plus, AlertTriangle, Search } from "lucide-react"
import type { Tag, TagDimension } from "@/lib/types/database"

interface TagSelectorProps {
  dimension: TagDimension
  selectedTagId: string | null // For single-select
  selectedTagIds?: string[] // For multi-select
  onSelect: (tagId: string) => void // Called when tag is selected
  onCreate?: (label: string) => Promise<string | null> // Returns new tag ID or null
  clientId: string
  userId: string | null
  className?: string
}

// Fuzzy match function for finding similar tags
function fuzzyMatch(str1: string, str2: string): boolean {
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

export function TagSelector({
  dimension,
  selectedTagId,
  selectedTagIds = [],
  onSelect,
  onCreate,
  clientId,
  userId,
  className = "",
}: TagSelectorProps) {
  const isMultiSelect = dimension.allows_multiple
  const isSelected = (tagId: string) => {
    if (isMultiSelect) {
      return selectedTagIds.includes(tagId)
    }
    return selectedTagId === tagId
  }
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadTags()
  }, [dimension.dimension_key, clientId])

  const loadTags = async () => {
    setIsLoading(true)
    try {
      // Get parent tag for this dimension (if hierarchical)
      let parentTagId: string | null = null
      if (dimension.is_hierarchical) {
        const { data: parentTag } = await supabase
          .from("tags")
          .select("id")
          .eq("dimension_key", dimension.dimension_key)
          .is("parent_id", null)
          .eq("client_id", clientId)
          .single()

        parentTagId = parentTag?.id || null
      }

      // Get child tags (sub-tags) for this dimension
      // IMPORTANT: For hierarchical dimensions, exclude parent tags (where parent_id IS NULL)
      // Parent tags are just organizational, not meant to be selected
      const query = supabase
        .from("tags")
        .select(`
          *,
          asset_tags(count)
        `)
        .eq("dimension_key", dimension.dimension_key)
        .or(`client_id.eq.${clientId},client_id.is.null`)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true })

      if (dimension.is_hierarchical && parentTagId) {
        // For hierarchical: only show child tags (tags with this parent)
        query.eq("parent_id", parentTagId)
      } else if (dimension.is_hierarchical) {
        // For hierarchical but no parent yet: exclude parent tags themselves
        // Parent tags have parent_id IS NULL and are organizational only
        query.not("parent_id", "is", null)
      }
      // For flat dimensions: show all tags (no parent_id filtering needed)

      const { data: tags, error } = await query

      if (error) {
        console.error("Error loading tags:", error)
      } else {
        // Add asset count to tags
        const tagsWithCounts = (tags || []).map((tag: any) => ({
          ...tag,
          asset_count: tag.asset_tags?.[0]?.count || 0,
        }))
        setAvailableTags(tagsWithCounts)
      }
    } catch (error) {
      console.error("Error loading tags:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return availableTags

    const query = searchQuery.toLowerCase().trim()
    return availableTags.filter((tag) =>
      tag.label.toLowerCase().includes(query)
    )
  }, [availableTags, searchQuery])

  // Find exact and similar matches
  const exactMatch = useMemo(() => {
    if (!searchQuery.trim()) return null
    const query = searchQuery.toLowerCase().trim()
    return availableTags.find(
      (tag) => tag.label.toLowerCase() === query
    )
  }, [availableTags, searchQuery])

  const similarMatches = useMemo(() => {
    if (!searchQuery.trim() || exactMatch) return []
    const query = searchQuery.toLowerCase().trim()
    return availableTags
      .filter((tag) => fuzzyMatch(tag.label, query))
      .slice(0, 3) // Limit to 3 similar matches
  }, [availableTags, searchQuery, exactMatch])

  const handleCreate = async () => {
    if (!searchQuery.trim() || !onCreate) return
    if (exactMatch) {
      onSelect(exactMatch.id)
      setSearchQuery("")
      return
    }

    setIsCreating(true)
    try {
      const newTagId = await onCreate(searchQuery.trim())
      if (newTagId) {
        await loadTags() // Reload tags to include new one
        onSelect(newTagId)
        setSearchQuery("")
      }
    } catch (error) {
      console.error("Error creating tag:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim() && !exactMatch) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          placeholder={`Search or create ${dimension.label.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10"
        />
      </div>

      {/* Exact match warning */}
      {exactMatch && searchQuery.trim() && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <span>Tag "{exactMatch.label}" already exists</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              if (!isMultiSelect || !isSelected(exactMatch.id)) {
                onSelect(exactMatch.id)
                setSearchQuery("")
              }
            }}
          >
            <Check className="mr-2 h-4 w-4" />
            Use existing tag
          </Button>
        </div>
      )}

      {/* Similar matches */}
      {similarMatches.length > 0 && !exactMatch && searchQuery.trim() && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-sm font-medium text-blue-900">
            Similar tags found:
          </p>
          <div className="flex flex-wrap gap-2">
            {similarMatches.map((tag) => (
              <Button
                key={tag.id}
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isMultiSelect || !isSelected(tag.id)) {
                    onSelect(tag.id)
                    setSearchQuery("")
                  }
                }}
                className="text-blue-700"
              >
                {tag.label}
                {tag.asset_count > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {tag.asset_count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Existing tags list */}
      {!isLoading && (
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {filteredTags.length === 0 && !searchQuery.trim() && (
            <p className="py-4 text-center text-sm text-gray-500">
              No {dimension.label.toLowerCase()} tags yet. Create one above.
            </p>
          )}
          {filteredTags.length === 0 && searchQuery.trim() && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                No matching tags found. Create new tag:
              </p>
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {isCreating
                  ? "Creating..."
                  : `Create "${searchQuery.trim()}"`}
              </Button>
            </div>
          )}
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onSelect(tag.id)}
              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                isSelected(tag.id)
                  ? "border-primary bg-primary/10"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {isSelected(tag.id) && (
                  <Check className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm font-medium">{tag.label}</span>
              </div>
              {tag.asset_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {tag.asset_count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create new tag button (when typing and no exact match) */}
      {searchQuery.trim() &&
        !exactMatch &&
        onCreate &&
        dimension.allow_user_creation && (
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? "Creating..." : `Create "${searchQuery.trim()}"`}
          </Button>
        )}
    </div>
  )
}

