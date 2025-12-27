"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useTenant } from "@/lib/context/tenant-context"

interface TagDimension {
  dimension_key: string
  label: string
  allow_user_creation: boolean
  is_hierarchical: boolean
}

export default function CreateTagPage() {
  const { tenant } = useTenant()
  const [label, setLabel] = useState("")
  const [dimensionKey, setDimensionKey] = useState("")
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadDimensions()
  }, [])

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

      // Create slug from label
      const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

      // Get parent tag if hierarchical
      let parentId: string | null = null
      if (selectedDimension.is_hierarchical) {
        const { data: parentTag } = await supabase
          .from("tags")
          .select("id")
          .eq("dimension_key", dimensionKey)
          .is("parent_id", null)
          .or(`client_id.eq.${tenant.id},client_id.is.null`)
          .maybeSingle()
        parentId = parentTag?.id || null
      }

      // Determine tag_type for backward compatibility
      let tagType = "description"
      if (dimensionKey === "campaign" || dimensionKey === "brand_assets") {
        tagType = "category"
      } else if (dimensionKey === "visual_style") {
        tagType = "visual_style"
      } else if (dimensionKey === "usage") {
        tagType = "usage"
      } else if (dimensionKey === "file_type") {
        tagType = "file_type"
      }

      const { error: insertError } = await supabase.from("tags").insert({
        client_id: tenant.id,
        created_by: user.id,
        dimension_key: dimensionKey,
        parent_id: parentId,
        tag_type: tagType,
        label,
        slug,
        is_system: false,
      })

      if (insertError) throw insertError

      router.push("/tagging")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/tagging" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to tagging
        </Link>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create new tag</CardTitle>
          <CardDescription>Add a new tag to organize your assets</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Link href="/tagging">
                <Button type="button" variant="secondary" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="rounded-[25px]" style={{ backgroundColor: tenant.primary_color }} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create tag"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
