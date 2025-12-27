"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import type { TagDimension } from "@/lib/types/database"
import { createTag } from "@/lib/utils/tag-creation"

interface CreateTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateTagModal({ open, onOpenChange, onSuccess }: CreateTagModalProps) {
  const { tenant } = useTenant()
  const [label, setLabel] = useState("")
  const [dimensionKey, setDimensionKey] = useState("")
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      loadDimensions()
      // Reset form when modal opens
      setLabel("")
      setDimensionKey("")
      setError(null)
    }
  }, [open])

  const loadDimensions = async () => {
    const { data } = await supabase
      .from("tag_dimensions")
      .select("dimension_key, label, allow_user_creation, is_hierarchical")
      .eq("allow_user_creation", true)
      .order("display_order")

    setDimensions(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      if (!dimensionKey) {
        throw new Error("Please select a dimension")
      }

      const selectedDimension = dimensions.find(d => d.dimension_key === dimensionKey)
      if (!selectedDimension) {
        throw new Error("Invalid dimension selected")
      }

      // Use consolidated tag creation utility
      const tagId = await createTag(supabase, {
        label,
        dimensionKey,
        clientId: tenant.id,
        userId: user.id,
        dimension: selectedDimension,
      })

      if (!tagId) {
        throw new Error("Failed to create tag")
      }

      // Reset form and close modal
      setLabel("")
      setDimensionKey("")
      setError(null)
      onOpenChange(false)
      onSuccess?.()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create new tag</DialogTitle>
          <DialogDescription>Add a new tag to organize your assets</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="label">Tag label *</Label>
            <Input
              id="label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Campaign, Employee, Product"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimensionKey">Dimension *</Label>
            <Select value={dimensionKey} onValueChange={setDimensionKey} required>
              <SelectTrigger>
                <SelectValue placeholder="Select dimension" />
              </SelectTrigger>
              <SelectContent>
                {dimensions.map((dim) => (
                  <SelectItem key={dim.dimension_key} value={dim.dimension_key}>
                    {dim.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Select which dimension this tag belongs to. Tags are organized by dimensions.
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" style={{ backgroundColor: tenant.primary_color }} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create tag"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

