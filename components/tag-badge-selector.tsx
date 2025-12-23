"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X, Plus, AlertTriangle } from "lucide-react"
import type { Tag, TagDimension } from "@/lib/types/database"

interface TagBadgeSelectorProps {
  dimension: TagDimension
  selectedTagId?: string | null // For single-select
  selectedTagIds?: string[] // For multi-select
  onSelect: (tagId: string | null) => void // Called when tag is selected/deselected (for single-select)
  onToggle?: (tagId: string) => void // Called when tag is toggled (for multi-select)
  onCreate?: (label: string) => Promise<string | null> // Returns new tag ID or null
  clientId: string
  userId: string | null
  className?: string
}

// Fuzzy match function for finding similar tags
function fuzzyMatch(str1: string, str2: string): boolean {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return true
  if (s1.includes(s2) || s2.includes(s1)) return true
  
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length < 3) return false
  
  let matches = 0
  for (const char of shorter) {
    if (longer.includes(char)) matches++
  }
  
  return matches / shorter.length > 0.7
}

export function TagBadgeSelector({
  dimension,
  selectedTagId,
  selectedTagIds = [],
  onSelect,
  onToggle,
  onCreate,
  clientId,
  userId,
  className = "",
}: TagBadgeSelectorProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [createValue, setCreateValue] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const createInputRef = useRef<HTMLInputElement>(null)
  const createRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const isMultiSelect = dimension.allows_multiple
  const isSelected = (tagId: string) => {
    if (isMultiSelect) {
      return selectedTagIds.includes(tagId)
    }
    return selectedTagId === tagId
  }

  useEffect(() => {
    loadTags()
  }, [dimension.dimension_key, clientId])

  // Close create popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        createRef.current &&
        !createRef.current.contains(event.target as Node)
      ) {
        setShowCreate(false)
        setCreateValue("")
      }
    }

    if (showCreate) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showCreate])

  // Focus input when create opens
  useEffect(() => {
    if (showCreate && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [showCreate])

  const loadTags = async () => {
    try {
      // Get parent tag for this dimension (if hierarchical)
      let parentTagId: string | null = null
      if (dimension.is_hierarchical) {
        const { data: parentTag } = await supabase
          .from("tags")
          .select("id")
          .eq("dimension_key", dimension.dimension_key)
          .is("parent_id", null)
          .or(`client_id.eq.${clientId},client_id.is.null`)
          .maybeSingle()

        parentTagId = parentTag?.id || null
      }

      // Get child tags (sub-tags) for this dimension
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
        query.not("parent_id", "is", null)
      }

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
    }
  }

  // Find exact match
  const exactMatch = useMemo(() => {
    if (!createValue.trim()) return null
    const query = createValue.toLowerCase().trim()
    return availableTags.find(
      (tag) => tag.label.toLowerCase() === query
    )
  }, [availableTags, createValue])

  // Find similar matches
  const similarMatches = useMemo(() => {
    if (!createValue.trim() || exactMatch) return []
    const query = createValue.toLowerCase().trim()
    return availableTags
      .filter((tag) => fuzzyMatch(tag.label, query))
      .slice(0, 5)
  }, [availableTags, createValue, exactMatch])

  // Filter available tags for suggestions
  const suggestions = useMemo(() => {
    if (!createValue.trim()) {
      return availableTags
        .filter(tag => !isSelected(tag.id))
        .slice(0, 8)
    }

    const query = createValue.toLowerCase().trim()
    return availableTags
      .filter(tag => {
        if (isSelected(tag.id)) return false
        if (exactMatch && tag.id === exactMatch.id) return false
        return tag.label.toLowerCase().includes(query)
      })
      .slice(0, 8)
  }, [availableTags, createValue, exactMatch, isSelected])

  const handleSelectTag = (tag: Tag) => {
    if (isMultiSelect && onToggle) {
      onToggle(tag.id)
    } else {
      onSelect(tag.id)
    }
  }

  const handleCreateTag = async () => {
    if (!createValue.trim() || !onCreate || exactMatch) return

    // Double check if tag exists
    const trimmedValue = createValue.trim()
    const existingTag = availableTags.find(
      tag => tag.label.toLowerCase() === trimmedValue.toLowerCase()
    )
    
    if (existingTag) {
      handleSelectTag(existingTag)
      setShowCreate(false)
      setCreateValue("")
      return
    }

    setIsCreating(true)
    try {
      const newTagId = await onCreate(trimmedValue)
      if (newTagId) {
        setCreateValue("")
        await loadTags()
        setTimeout(() => {
          if (isMultiSelect && onToggle) {
            onToggle(newTagId)
          } else {
            onSelect(newTagId)
          }
          setShowCreate(false)
        }, 100)
      }
    } catch (error) {
      console.error("Error creating tag:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRemoveTag = (tagId: string) => {
    if (isMultiSelect && onToggle) {
      onToggle(tagId)
    } else {
      onSelect(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && createValue.trim() && !exactMatch) {
      e.preventDefault()
      handleCreateTag()
    } else if (e.key === "Escape") {
      setShowCreate(false)
      setCreateValue("")
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <Label className="text-xs font-medium text-gray-600">
        {dimension.label}
        {dimension.required && (
          <span className="ml-1 text-xs font-semibold text-red-500" title="Required - you must select at least one">
            *
          </span>
        )}
      </Label>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {availableTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleSelectTag(tag)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
              isSelected(tag.id)
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span>{tag.label}</span>
            {isSelected(tag.id) && (
              <X 
                className="h-3 w-3" 
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveTag(tag.id)
                }} 
              />
            )}
          </button>
        ))}

        {/* Add button */}
        {onCreate && dimension.allow_user_creation && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add {dimension.label.toLowerCase()}</span>
            </button>

            {/* Create popover */}
            {showCreate && (
              <div
                ref={createRef}
                className="absolute top-full left-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50"
              >
                <div className="p-4 space-y-3">
                  {/* Exact match warning */}
                  {exactMatch && createValue.trim() && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-yellow-900">
                            "{exactMatch.label}" already exists
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleSelectTag(exactMatch)
                              setShowCreate(false)
                              setCreateValue("")
                            }}
                            className="mt-2 w-full"
                          >
                            Use existing tag
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Similar matches */}
                  {similarMatches.length > 0 && !exactMatch && createValue.trim() && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Similar tags:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {similarMatches.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              handleSelectTag(tag)
                              setShowCreate(false)
                              setCreateValue("")
                            }}
                            className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          >
                            {tag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {suggestions.length > 0 && createValue.trim() && !exactMatch && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Suggestions:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              handleSelectTag(tag)
                              setShowCreate(false)
                              setCreateValue("")
                            }}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {tag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input */}
                  <div className="space-y-2">
                    <Input
                      ref={createInputRef}
                      type="text"
                      placeholder={`Enter ${dimension.label.toLowerCase()} name...`}
                      value={createValue}
                      onChange={(e) => setCreateValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isCreating}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateTag}
                        disabled={isCreating || !createValue.trim() || !!exactMatch}
                        size="sm"
                        className="flex-1"
                      >
                        {isCreating ? "Creating..." : "Create"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCreate(false)
                          setCreateValue("")
                        }}
                        size="sm"
                        disabled={isCreating}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {availableTags.length === 0 && (
        <div className="text-xs text-gray-400">
          No tags yet
        </div>
      )}
    </div>
  )
}
