"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormModal } from "@/components/form-modal"
import { useFormModal } from "@/hooks/use-form-modal"
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
  const supabase = createClient()

  const resetForm = () => {
    setLabel("")
    setDimensionKey("")
  }

  const { error, isLoading, handleSubmit, handleOpenChange } = useFormModal({
    onReset: resetForm,
    onSuccess: () => {
      onOpenChange(false)
      onSuccess?.()
    },
  })

  useEffect(() => {
    if (open) {
      loadDimensions()
      resetForm()
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleSubmit(async () => {
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
    })
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(newOpen) => handleOpenChange(newOpen, onOpenChange)}
      title="Create new tag"
      description="Add a new tag to organize your assets"
      error={error}
      isLoading={isLoading}
      submitLabel="Create tag"
      loadingLabel="Creating..."
      submitButtonStyle={{ backgroundColor: tenant.primary_color }}
      contentClassName="max-w-2xl"
      onSubmit={onSubmit}
    >
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
    </FormModal>
  )
}

