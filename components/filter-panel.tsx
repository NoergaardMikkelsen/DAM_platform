"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface Tag {
  id: string
  tag_type: string
  label: string
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  onApplyFilters: (filters: {
    categoryTags: string[]
    descriptionTags: string[]
    usageTags: string[]
    visualStyleTags: string[]
    fileTypeTags: string[]
  }) => void
  showCategoryFilter?: boolean
}

export function FilterPanel({ isOpen, onClose, onApplyFilters, showCategoryFilter = true }: FilterPanelProps) {
  const [categoryTags, setCategoryTags] = useState<string[]>([])
  const [descriptionTags, setDescriptionTags] = useState<string[]>([])
  const [usageTags, setUsageTags] = useState<string[]>([])
  const [visualStyleTags, setVisualStyleTags] = useState<string[]>([])
  const [fileTypeTags, setFileTypeTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])

  useEffect(() => {
    if (isOpen) {
      loadTags()
    }
  }, [isOpen])

  const loadTags = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single()

    if (!clientUsers?.client_id) return

    const { data: tags } = await supabase
      .from("tags")
      .select("id, tag_type, label")
      .or(`client_id.eq.${clientUsers.client_id},is_system.eq.true`)
      .order("tag_type")
      .order("sort_order")

    if (tags) {
      setAvailableTags(tags)
    }
  }

  const toggleTag = (tagId: string, type: string) => {
    if (type === "category") {
      setCategoryTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
    } else if (type === "description") {
      setDescriptionTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
    } else if (type === "usage") {
      setUsageTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
    } else if (type === "visual_style") {
      setVisualStyleTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
    } else if (type === "file_type") {
      setFileTypeTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
    }
  }

  const handleApply = () => {
    onApplyFilters({
      categoryTags,
      descriptionTags,
      usageTags,
      visualStyleTags,
      fileTypeTags,
    })
  }

  const handleClear = () => {
    setCategoryTags([])
    setDescriptionTags([])
    setUsageTags([])
    setVisualStyleTags([])
    setFileTypeTags([])
  }

  const categories = availableTags.filter((t) => t.tag_type === "category")
  const descriptions = availableTags.filter((t) => t.tag_type === "description")
  const usages = availableTags.filter((t) => t.tag_type === "usage")
  const visualStyles = availableTags.filter((t) => t.tag_type === "visual_style")
  const fileTypes = availableTags.filter((t) => t.tag_type === "file_type")

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white shadow-xl" suppressHydrationWarning>
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-semibold">Filter</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Category Tags */}
          {showCategoryFilter && categories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Category</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id, "category")}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      categoryTags.includes(tag.id)
                        ? "border-[#dc3545] bg-[#dc3545] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description Tags */}
          {descriptions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Description tags</Label>
              <div className="flex flex-wrap gap-2">
                {descriptions.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id, "description")}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      descriptionTags.includes(tag.id)
                        ? "border-[#dc3545] bg-[#dc3545] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Usage / Purpose Tags */}
          {usages.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Usage / Purpose</Label>
              <div className="flex flex-wrap gap-2">
                {usages.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id, "usage")}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      usageTags.includes(tag.id)
                        ? "border-[#dc3545] bg-[#dc3545] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visual Style Tags */}
          {visualStyles.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Visual style</Label>
              <div className="flex flex-wrap gap-2">
                {visualStyles.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id, "visual_style")}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      visualStyleTags.includes(tag.id)
                        ? "border-[#dc3545] bg-[#dc3545] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File Type Tags */}
          {fileTypes.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">File type</Label>
              <div className="flex flex-wrap gap-2">
                {fileTypes.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id, "file_type")}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      fileTypeTags.includes(tag.id)
                        ? "border-[#dc3545] bg-[#dc3545] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t bg-white p-6">
          <Button variant="outline" onClick={handleClear} className="flex-1 bg-transparent">
            Clear
          </Button>
          <Button onClick={handleApply} className="flex-1 bg-[#dc3545] hover:bg-[#c82333]">
            Apply filters
          </Button>
        </div>
      </div>
    </>
  )
}
