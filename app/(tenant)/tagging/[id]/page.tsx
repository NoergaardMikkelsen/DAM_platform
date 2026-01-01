"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Tag, Settings, Trash2, Database } from "lucide-react"
import Link from "next/link"
import React, { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { formatDate } from "@/lib/utils/date"
import { useToast } from "@/hooks/use-toast"
import { handleError, handleSuccess } from "@/lib/utils/error-handling"
import { getSortOrderLabel, SORT_ORDER_OPTIONS } from "@/lib/utils/sorting"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Tag {
  id: string
  label: string
  slug: string
  dimension_key: string | null
  tag_type?: string // Legacy field
  is_system: boolean
  sort_order: number
  client_id: string
  created_by: string | null
  created_at: string
  updated_at: string
  creator_name?: string
  asset_count?: number
}

export default function TagDetailPage() {
  const { tenant, role } = useTenant()
  const isAdmin = role === 'admin' || role === 'superadmin'
  const params = useParams()
  const id = params?.id as string
  const [tag, setTag] = useState<Tag | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    label: "",
    slug: "",
    sort_order: 0
  })
  const { toast } = useToast()
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadCurrentUser()
    if (!id) return
    loadTag()
  }, [id])

  const loadCurrentUser = async () => {
    const supabase = supabaseRef.current
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  const loadTag = async () => {
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id
    const supabase = supabaseRef.current

    // Get tag details for this tenant (including system tags)
    const { data: tagData } = await supabase
      .from("tags")
      .select(`
        *,
        users (full_name)
      `)
      .eq("id", id)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .single()

    if (!tagData) {
      router.push("/tagging")
      return
    }

    // Redirect if trying to access system tag detail page from tenant area
    if (tagData.is_system) {
      router.push("/tagging")
      return
    }

    // Get asset count for this tag (only counting assets from this tenant)
    const { count: assetCount } = await supabase
      .from("asset_tags")
      .select(`
        assets!inner(client_id)
      `, { count: "exact", head: true })
      .eq("tag_id", id)
      .eq("assets.client_id", clientId)

    const tagWithStats: Tag = {
      ...tagData,
      creator_name: tagData.users?.full_name || "System",
      asset_count: assetCount || 0
    }

    setTag(tagWithStats)
    setEditForm({
      label: tagWithStats.label,
      slug: tagWithStats.slug,
      sort_order: tagWithStats.sort_order
    })

    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!tag) return

    // System tags cannot be edited from tenant area
    if (tag.is_system) {
      alert("System tags can only be edited from the system admin area.")
      setIsEditing(false)
      return
    }

    const supabase = supabaseRef.current
    setIsLoading(true)

    const { error } = await supabase
      .from("tags")
      .update({
        label: editForm.label,
        slug: editForm.slug,
        sort_order: editForm.sort_order
      })
      .eq("id", tag.id)

    if (error) {
      if (error.code === "42501" || error.message?.includes("permission")) {
        alert("You don't have permission to edit this tag.")
      } else {
        alert(`Failed to update tag: ${error.message || "Unknown error"}`)
      }
    } else {
      setIsEditing(false)
      await loadTag() // Reload data
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!tag) return

    if (tag.is_system) {
      alert("Cannot delete system tags")
      return
    }

    // TODO: Implement delete confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete tag "${tag.label}"? This will remove it from all associated assets.`)

    if (!confirmed) return

    const supabase = supabaseRef.current
    setIsLoading(true)

    // Delete asset_tags first (cascade will handle)
    await supabase
      .from("asset_tags")
      .delete()
      .eq("tag_id", tag.id)

    // Delete the tag
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", tag.id)

    if (error) {
      handleError(error, toast, {
        title: "Failed to delete tag",
        description: "Could not delete tag. Please try again.",
      })
    } else {
      handleSuccess(toast, "Tag deleted successfully")
      router.push("/tagging")
    }

    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-600">Loading tag...</p>
        </div>
      </div>
    )
  }

  if (!tag) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-600">Tag not found</p>
          <Link href="/tagging">
            <Button className="mt-4">Back to Tags</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-10">
        <div className="mb-6">
          <Link href="/tagging">
            <Button variant="secondary" className="flex items-center gap-2">
              <svg
                viewBox="0 8 25 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                style={{ transform: 'scaleX(-1)' }}
              >
                <path
                  d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
              Back to Tags
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#DF475C] text-white">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{tag.label}</h1>
              <p className="text-gray-500 mt-1">{tag.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Show edit/delete buttons if tag is not system AND (user is admin OR user created this tag) */}
            {!tag.is_system && (isAdmin || (currentUserId && tag.created_by === currentUserId)) && (
              <>
                {!isEditing ? (
                  <Button variant="secondary" onClick={() => setIsEditing(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEdit} disabled={isLoading}>
                      Save Changes
                    </Button>
                  </>
                )}
                {/* Only admins can delete tags */}
                {isAdmin && (
                  <Button variant="secondary" onClick={handleDelete} disabled={isLoading}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tag Information */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle>Tag Information</CardTitle>
            <CardDescription>Tag details and configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Label</Label>
                  <p className="text-gray-900">{tag.label}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Slug</Label>
                  <p className="text-gray-900">{tag.slug}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Dimension</Label>
                  <Badge variant="outline" className="capitalize">
                    {tag.dimension_key 
                      ? tag.dimension_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                      : tag.tag_type?.replace("_", " ") || "Unknown"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Display Priority</Label>
                  <p className="text-gray-900">{getSortOrderLabel(tag.sort_order)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created By</Label>
                  <p className="text-gray-900">{tag.creator_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created At</Label>
                  <p className="text-gray-900">
                    {formatDate(tag.created_at, "long")}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    value={editForm.label}
                    onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={editForm.slug}
                    onChange={(e) => setEditForm(prev => ({ ...prev, slug: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Display Priority</Label>
                  <Select
                    value={getSortOrderLabel(editForm.sort_order)}
                    onValueChange={(value) => {
                      const sortValue = SORT_ORDER_OPTIONS.find(opt => opt.label === value)?.value ?? 0
                      setEditForm(prev => ({ ...prev, sort_order: sortValue }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_ORDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.label}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="space-y-6">
          {/* Assets Count */}
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{tag.asset_count}</div>
              <p className="text-sm text-gray-600">Assets tagged with this tag</p>
            </CardContent>
          </Card>

          {/* Tag Properties */}
          <Card className="border-0">
            <CardHeader>
              <CardTitle>Tag Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">System Tag</span>
                <Badge variant={tag.is_system ? "default" : "secondary"}>
                  {tag.is_system ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Dimension</span>
                <Badge variant="outline" className="capitalize">
                  {tag.dimension_key 
                    ? tag.dimension_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    : tag.tag_type?.replace("_", " ") || "Unknown"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sort Order</span>
                <span className="text-sm font-medium">{tag.sort_order}</span>
              </div>
            </CardContent>
          </Card>

          {/* Usage Information */}
          <Card className="border-0">
            <CardHeader>
              <CardTitle>Usage Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  This tag belongs to the {tag.dimension_key 
                    ? tag.dimension_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    : tag.tag_type?.replace("_", " ") || "unknown"} dimension.
                </p>
                {tag.asset_count === 0 && (
                  <p className="text-orange-600">
                    This tag is not currently used by any assets.
                  </p>
                )}
                {tag.is_system && (
                  <p className="text-blue-600">
                    This is a system tag and cannot be deleted.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
