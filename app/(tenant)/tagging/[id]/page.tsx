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
import React, { useState, useEffect, useRef, use } from "react"
import { useRouter, useParams } from "next/navigation"
import { DetailPageHeaderSkeleton, FormSkeleton, StatsCardsSkeleton } from "@/components/skeleton-loaders"
import { Skeleton } from "@/components/ui/skeleton"

interface Tag {
  id: string
  label: string
  slug: string
  tag_type: string
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
  const params = useParams() as { id: string }
  const id = params.id
  const [tag, setTag] = useState<Tag | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    label: "",
    slug: "",
    sort_order: 0
  })
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!id) return
    loadTag()
  }, [id])

  const loadTag = async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Check if user is admin or superadmin
    const { data: userRole } = await supabase
      .from("client_users")
      .select(`roles(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    const role = userRole?.roles?.key
    if (role !== "admin" && role !== "superadmin") {
      router.push("/dashboard")
      return
    }

    // Get tag details
    const { data: tagData } = await supabase
      .from("tags")
      .select(`
        *,
        users (full_name)
      `)
      .eq("id", id)
      .single()

    if (!tagData) {
      router.push("/tagging")
      return
    }

    // Get asset count for this tag
    const { count: assetCount } = await supabase
      .from("asset_tags")
      .select("*", { count: "exact", head: true })
      .eq("tag_id", id)

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
      console.error("Error updating tag:", error)
      // TODO: Show error toast
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
      console.error("Error deleting tag:", error)
      // TODO: Show error toast
    } else {
      router.push("/tagging")
    }

    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <DetailPageHeaderSkeleton showActions={true} />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Tag Information Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle><Skeleton className="h-6 w-32" /></CardTitle>
              <CardDescription><Skeleton className="h-4 w-48" /></CardDescription>
            </CardHeader>
            <CardContent>
              <FormSkeleton fields={4} />
            </CardContent>
          </Card>

          {/* Stats Cards Skeleton */}
          <StatsCardsSkeleton count={3} />
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
      <div className="mb-8">
        <Link href="/tagging" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tags
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#DF475C] text-white">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{tag.label}</h1>
              <p className="text-gray-500">{tag.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tag.is_system && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                System Tag
              </Badge>
            )}
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={isLoading}>
                  Save Changes
                </Button>
              </>
            )}
            {!tag.is_system && (
              <Button variant="outline" onClick={handleDelete} disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tag Information */}
        <Card>
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
                  <Label className="text-sm font-medium text-gray-700">Type</Label>
                  <Badge variant="outline" className="capitalize">
                    {tag.tag_type.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Sort Order</Label>
                  <p className="text-gray-900">{tag.sort_order}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created By</Label>
                  <p className="text-gray-900">{tag.creator_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created At</Label>
                  <p className="text-gray-900">
                    {new Date(tag.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
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
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={editForm.sort_order}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="space-y-6">
          {/* Assets Count */}
          <Card>
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
          <Card>
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
                <span className="text-sm text-gray-600">Tag Type</span>
                <Badge variant="outline" className="capitalize">
                  {tag.tag_type.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sort Order</span>
                <span className="text-sm font-medium">{tag.sort_order}</span>
              </div>
            </CardContent>
          </Card>

          {/* Usage Information */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  This tag is used to categorize assets in the {tag.tag_type.replace("_", " ")} category.
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
