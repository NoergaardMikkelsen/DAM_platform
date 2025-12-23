"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"

interface Tag {
  id: string
  label: string
  slug: string
  dimension_key: string | null
  parent_id: string | null
  tag_type?: string // Legacy field
  is_system: boolean
  sort_order: number
  client_id: string
  created_by: string | null
  created_at: string
  updated_at: string
  users?: {
    full_name: string
  } | null
  asset_count?: number
}

interface TagDimension {
  dimension_key: string
  label: string
}

export default function TaggingPage() {
  const { tenant } = useTenant()
  const [tags, setTags] = useState<Tag[]>([])
  const [filteredTags, setFilteredTags] = useState<Tag[]>([])
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [childTagsCount, setChildTagsCount] = useState<number>(0)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadDimensions()
    loadTags()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [tags, dimensionFilter, searchQuery])

  const loadDimensions = async () => {
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from("tag_dimensions")
      .select("dimension_key, label")
      .order("display_order")

    setDimensions(data || [])
  }

  const loadTags = async () => {
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id
    const supabase = supabaseRef.current

    let tagsData: Tag[] = []

    // Get tags for this tenant (including system tags)
    // Exclude parent tags for hierarchical dimensions (they're structural only)
    // Include tags with NULL dimension_key (legacy tags) for backward compatibility
    const { data: clientTags } = await supabase
      .from("tags")
      .select(
        `
        *,
        users (full_name),
        tag_dimensions(label)
      `,
      )
      .or(`client_id.eq.${tenant.id},client_id.is.null`)
      .or("parent_id.is.null,parent_id.not.is.null") // Include all tags, but we'll filter parent tags below
      .order("dimension_key")
      .order("sort_order")

    // Filter out parent tags manually (parent tags have parent_id IS NULL and belong to hierarchical dimensions)
    const { data: hierarchicalDimensions } = await supabase
      .from("tag_dimensions")
      .select("dimension_key")
      .eq("is_hierarchical", true)

    const hierarchicalDimKeys = new Set(hierarchicalDimensions?.map(d => d.dimension_key) || [])
    
    const filteredTags = (clientTags || []).filter((tag: any) => {
      // Exclude parent tags (tags with parent_id IS NULL in hierarchical dimensions)
      if (tag.parent_id === null && tag.dimension_key && hierarchicalDimKeys.has(tag.dimension_key)) {
        return false
      }
      return true
    })

    tagsData = filteredTags || []

    // Get asset counts for each tag
    const tagCountsMap = new Map<string, number>()

    if (tagsData.length > 0) {
      // Get all asset_tags for assets belonging to this tenant
      // Since RLS is disabled, we need to manually filter by client_id
      const { data: assetTags } = await supabase
        .from("asset_tags")
        .select(`
          tag_id,
          assets(client_id)
        `)
        .eq("assets.client_id", tenant.id)

      // Count occurrences of each tag_id (only for tags we're displaying)
      const relevantTagIds = new Set(tagsData.map(t => t.id))
      if (assetTags) {
        assetTags.forEach((at: any) => {
          if (relevantTagIds.has(at.tag_id)) {
            const currentCount = tagCountsMap.get(at.tag_id) || 0
            tagCountsMap.set(at.tag_id, currentCount + 1)
          }
        })
      }
    }

    // Add asset counts to tags
    const tagsWithCounts = tagsData.map((tag) => ({
      ...tag,
      asset_count: tagCountsMap.get(tag.id) || 0,
    }))

    setTags(tagsWithCounts)
    setFilteredTags(tagsWithCounts)
    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...tags]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((tag) =>
        tag.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply dimension filter
    if (dimensionFilter !== "all") {
      if (dimensionFilter === "legacy") {
        filtered = filtered.filter((tag) => !tag.dimension_key)
      } else {
        filtered = filtered.filter((tag) => tag.dimension_key === dimensionFilter)
      }
    }

    setFilteredTags(filtered)
  }

  const handleDelete = async () => {
    if (!tagToDelete) return

    if (tagToDelete.is_system) {
      alert("Cannot delete system tags")
      setTagToDelete(null)
      return
    }

    const supabase = supabaseRef.current
    setIsDeleting(true)

    try {
      // Check if this tag has child tags (tags that reference this tag as parent)
      const { data: childTags, error: childTagsError } = await supabase
        .from("tags")
        .select("id, label")
        .eq("parent_id", tagToDelete.id)

      if (childTagsError) {
        console.error("Error checking child tags:", childTagsError)
      }

      // If there are child tags, delete them first (cascade delete)
      if (childTags && childTags.length > 0) {
        const childTagIds = childTags.map((t: any) => t.id)
        
        // Delete asset_tags for all child tags first
        const { error: childAssetTagsError } = await supabase
          .from("asset_tags")
          .delete()
          .in("tag_id", childTagIds)

        if (childAssetTagsError) {
          console.error("Error deleting asset_tags for child tags:", childAssetTagsError)
          alert(`Failed to remove child tags from assets: ${childAssetTagsError.message || childAssetTagsError.code || "Unknown error"}`)
          setIsDeleting(false)
          setTagToDelete(null)
          return
        }

        // Delete all child tags
        const { error: childTagsDeleteError } = await supabase
          .from("tags")
          .delete()
          .in("id", childTagIds)

        if (childTagsDeleteError) {
          console.error("Error deleting child tags:", childTagsDeleteError)
          alert(`Failed to delete child tags: ${childTagsDeleteError.message || childTagsDeleteError.code || "Unknown error"}`)
          setIsDeleting(false)
          setTagToDelete(null)
          return
        }
      }

      // Delete asset_tags first (remove tag from all assets)
      // RLS will handle authorization - if user doesn't have permission, this will fail
      const { error: assetTagsError } = await supabase
        .from("asset_tags")
        .delete()
        .eq("tag_id", tagToDelete.id)

      if (assetTagsError) {
        console.error("Error deleting asset_tags:", assetTagsError)
        console.error("Full error object:", JSON.stringify(assetTagsError, null, 2))
        alert(`Failed to remove tag from assets: ${assetTagsError.message || assetTagsError.code || "Unknown error"}`)
        setIsDeleting(false)
        setTagToDelete(null)
        return
      }

      // Delete the tag
      const { error: tagError } = await supabase
        .from("tags")
        .delete()
        .eq("id", tagToDelete.id)

      if (tagError) {
        console.error("Error deleting tag:", tagError)
        console.error("Full error object:", JSON.stringify(tagError, null, 2))
        
        // Check if it's a foreign key constraint error (child tags)
        if (tagError.code === "23503" || tagError.message?.includes("foreign key") || tagError.message?.includes("parent_id")) {
          alert("Cannot delete this tag because it has child tags. Please delete the child tags first.")
        } else if (tagError.code === "42501" || tagError.message?.includes("permission") || tagError.message?.includes("policy")) {
          alert("You don't have permission to delete this tag. You need admin or superadmin role.")
        } else {
          const errorMessage = tagError.message || tagError.code || tagError.hint || "Unknown error"
          alert(`Failed to delete tag: ${errorMessage}`)
        }
      } else {
        // Reload tags to reflect the deletion
        await loadTags()
      }
    } catch (error: any) {
      console.error("Error deleting tag:", error)
      console.error("Full error object:", JSON.stringify(error, null, 2))
      
      // Check if it's a permission error
      if (error?.code === "42501" || error?.message?.includes("permission") || error?.message?.includes("policy")) {
        alert("You don't have permission to delete this tag. You need admin or superadmin role.")
      } else {
        const errorMessage = error?.message || error?.code || error?.toString() || "Unknown error"
        alert(`Failed to delete tag: ${errorMessage}`)
      }
    } finally {
      setIsDeleting(false)
      setTagToDelete(null)
      setChildTagsCount(0)
    }
  }

  // Show loading skeleton while checking access (before redirect happens)
  if (isLoading) {
    return (
      <div className="p-8">
        <ListPageHeaderSkeleton showCreateButton={true} />
        <SearchSkeleton />
        <TabsSkeleton count={3} />
        <TableSkeleton rows={8} columns={4} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Tagging</h1>
        <Link href="/tagging/create">
          <Button className="rounded-[25px]" style={{ backgroundColor: tenant.primary_color }}>
            <Plus className="mr-2 h-4 w-4" />
            Create new tag
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search tag"
            className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs - Show all dimensions */}
      <Tabs value={dimensionFilter} onValueChange={setDimensionFilter} className="mb-6">
        <TabsList suppressHydrationWarning className="flex-wrap">
          <TabsTrigger value="all">All Tags</TabsTrigger>
          {dimensions.map((dim) => (
            <TabsTrigger key={dim.dimension_key} value={dim.dimension_key}>
              {dim.label}
            </TabsTrigger>
          ))}
          {tags.some(t => !t.dimension_key) && (
            <TabsTrigger value="legacy">Legacy</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Tags Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tag</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Dimension</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created by</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Assets</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredTags?.map((tag) => (
              <tr
                key={tag.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/tagging/${tag.id}`)}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{tag.label}</td>
                <td className="px-6 py-4 text-sm capitalize text-gray-600">
                  {tag.dimension_key 
                    ? tag.dimension_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    : tag.tag_type?.replace("_", " ") || "Unknown"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {tag.users?.full_name || new Date(tag.created_at).toLocaleDateString("en-GB")}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{tag.asset_count || 0}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/tagging/${tag.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4 text-gray-600" />
                      </Button>
                    </Link>
                    {!tag.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async (e) => {
                          e.stopPropagation()
                          // Check for child tags before showing dialog
                          const supabase = supabaseRef.current
                          const { data: childTags } = await supabase
                            .from("tags")
                            .select("id")
                            .eq("parent_id", tag.id)
                          
                          setChildTagsCount(childTags?.length || 0)
                          setTagToDelete(tag)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Delete Confirmation Dialog */}
        <AlertDialog 
          open={!!tagToDelete} 
          onOpenChange={(open) => {
            if (!open) {
              setTagToDelete(null)
              setChildTagsCount(0)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tag</AlertDialogTitle>
              <AlertDialogDescription>
                {childTagsCount > 0 ? (
                  <>
                    Are you sure you want to delete the tag "{tagToDelete?.label}"? This will also delete {childTagsCount} child tag{childTagsCount > 1 ? "s" : ""} and remove them from all associated assets. This action cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete the tag "{tagToDelete?.label}"? This will remove it from all associated assets. This action cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            ←
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-gray-100">
            1
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-transparent">
            2
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-transparent">
            3
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            →
          </Button>
        </div>
      </div>
    </div>
  )
}
