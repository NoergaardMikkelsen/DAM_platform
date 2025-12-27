"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronDown } from "lucide-react"
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
import { Pencil, Plus, Search, Trash2, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { CreateTagModal } from "@/components/create-tag-modal"
import { formatDate } from "@/lib/utils/date"
import { usePagination } from "@/hooks/use-pagination"
import { PAGINATION } from "@/lib/constants"
import { logError } from "@/lib/utils/logger"
import { PageHeader } from "@/components/page-header"
import { useSearchFilter } from "@/hooks/use-search-filter"

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

interface AssetTag {
  tag_id: string
  asset_id: string
  assets?: {
    client_id: string
  }
}

interface ChildTag {
  id: string
  label: string
}

export default function TaggingPage() {
  const { tenant } = useTenant()
  const [tags, setTags] = useState<Tag[]>([])
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [childTagsCount, setChildTagsCount] = useState<number>(0)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  // Use search filter hook
  const {
    searchQuery,
    setSearchQuery,
    filteredItems: searchFilteredTags,
  } = useSearchFilter({
    items: tags,
    searchFields: (tag) => [tag.label, tag.slug],
  })

  // Apply dimension filter on top of search filter
  const filteredTags = dimensionFilter === "all"
    ? searchFilteredTags
    : dimensionFilter === "legacy"
    ? searchFilteredTags.filter((tag) => !tag.dimension_key)
    : searchFilteredTags.filter((tag) => tag.dimension_key === dimensionFilter)

  // Use pagination hook
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems: paginatedTags,
    goToPage,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
  } = usePagination(filteredTags, {
    calculateItemsPerPage: true,
    fixedHeight: PAGINATION.DEFAULT_FIXED_HEIGHT,
    rowHeight: PAGINATION.DEFAULT_ROW_HEIGHT,
    minItemsPerPage: PAGINATION.MIN_ITEMS_PER_PAGE,
  })

  useEffect(() => {
    loadTags()
  }, [])

  // Update dimensions based on actually loaded tags (after filtering)
  useEffect(() => {
    if (tags.length === 0) return
    
    // Get unique dimension keys from loaded tags
    const dimensionKeysWithTags = new Set(
      tags
        .map((tag) => tag.dimension_key)
        .filter((key): key is string => key !== null)
    )
    
    // Load dimensions that match these keys
    const loadDimensionsFromTags = async () => {
      const supabase = supabaseRef.current
      
      if (dimensionKeysWithTags.size > 0) {
        const { data } = await supabase
          .from("tag_dimensions")
          .select("dimension_key, label")
          .in("dimension_key", Array.from(dimensionKeysWithTags))
          .order("display_order")

        setDimensions(data || [])
      } else {
        setDimensions([])
      }
    }
    
    loadDimensionsFromTags()
  }, [tags])



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

    const hierarchicalDimKeys = new Set(hierarchicalDimensions?.map((d: { dimension_key: string }) => d.dimension_key) || [])
    
    const filteredTags = (clientTags || []).filter((tag: Tag) => {
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
        assetTags.forEach((at: AssetTag) => {
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
    setIsLoading(false)
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
        logError("Error checking child tags:", childTagsError)
      }

      // If there are child tags, delete them first (cascade delete)
      if (childTags && childTags.length > 0) {
        const childTagIds = childTags.map((t: ChildTag) => t.id)
        
        // Delete asset_tags for all child tags first
        const { error: childAssetTagsError } = await supabase
          .from("asset_tags")
          .delete()
          .in("tag_id", childTagIds)

        if (childAssetTagsError) {
          logError("Error deleting asset_tags for child tags:", childAssetTagsError)
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
          logError("Error deleting child tags:", childTagsDeleteError)
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
        logError("Error deleting asset_tags:", assetTagsError)
        logError("Full error object:", JSON.stringify(assetTagsError, null, 2))
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
        logError("Error deleting tag:", tagError)
        logError("Full error object:", JSON.stringify(tagError, null, 2))
        
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
    } catch (error: unknown) {
      logError("Error deleting tag:", error)
      logError("Full error object:", JSON.stringify(error, null, 2))
      
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

  const handleCreateSuccess = () => {
    loadTags()
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
      <PageHeader
        title="Tagging"
        createButton={{
          label: "Create new tag",
          onClick: () => setIsCreateModalOpen(true),
          style: { backgroundColor: tenant.primary_color },
        }}
        search={{
          placeholder: "Search tag",
          value: searchQuery,
          onChange: setSearchQuery,
          position: "below",
        }}
      />
      <CreateTagModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Tabs - Show all dimensions */}
      <Tabs value={dimensionFilter} onValueChange={setDimensionFilter} className="mb-0">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All Tags</TabsTrigger>
          {dimensions.slice(0, 4).map((dim) => (
            <TabsTrigger key={dim.dimension_key} value={dim.dimension_key}>
              {dim.label}
            </TabsTrigger>
          ))}
          {(dimensions.length > 4 || tags.some(t => !t.dimension_key)) && (() => {
            const hasActiveInDropdown = dimensions.slice(4).some(dim => dimensionFilter === dim.dimension_key) || 
                                       (tags.some(t => !t.dimension_key) && dimensionFilter === 'legacy')
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`relative cursor-pointer inline-flex h-[35px] items-center justify-center gap-2 px-6 py-2 text-sm font-thin whitespace-nowrap transition-all ${
                      hasActiveInDropdown 
                        ? 'bg-white text-gray-900 font-light' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{
                      marginRight: '-8px',
                      borderRadius: 0,
                      WebkitMaskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='119' height='33' viewBox='0 0 119 33' preserveAspectRatio='none'%3E%3Cpath d='M0 20C0 8.9543 8.95431 0 20 0H92.9915C101.402 0 108.913 5.26135 111.787 13.1651L119 33H0V20Z' fill='black'/%3E%3C/svg%3E\")",
                      maskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='119' height='33' viewBox='0 0 119 33' preserveAspectRatio='none'%3E%3Cpath d='M0 20C0 8.9543 8.95431 0 20 0H92.9915C101.402 0 108.913 5.26135 111.787 13.1651L119 33H0V20Z' fill='black'/%3E%3C/svg%3E\")",
                      WebkitMaskSize: '100% 100%',
                      maskSize: '100% 100%',
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                      boxShadow: hasActiveInDropdown ? '2px 3px 5px 0 rgba(0, 0, 0, 0.05)' : 'none',
                      zIndex: hasActiveInDropdown ? 20 : 1,
                    }}
                  >
                    More <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px] bg-white border border-gray-200 shadow-lg rounded-md p-1">
                  {dimensions.slice(4).map((dim) => (
                    <DropdownMenuItem
                      key={dim.dimension_key}
                      onClick={() => setDimensionFilter(dim.dimension_key)}
                      className={`px-3 py-2 text-sm font-thin rounded-sm transition-colors focus:bg-transparent ${
                        dimensionFilter === dim.dimension_key 
                          ? 'bg-white text-gray-900 font-light' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {dim.label}
                    </DropdownMenuItem>
                  ))}
                  {tags.some(t => !t.dimension_key) && (
                    <DropdownMenuItem
                      onClick={() => setDimensionFilter('legacy')}
                      className={`px-3 py-2 text-sm font-thin rounded-sm transition-colors focus:bg-transparent ${
                        dimensionFilter === 'legacy' 
                          ? 'bg-white text-gray-900 font-light' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Legacy
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          })()}
          {dimensions.length <= 4 && tags.some(t => !t.dimension_key) && (
            <TabsTrigger value="legacy">Legacy</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Tags Table */}
      <TooltipProvider>
        <div className="overflow-hidden" style={{ borderRadius: '0 20px 20px 20px', background: '#FFF' }}>
          <table className="w-full">
          <thead>
            <tr className="rounded-[20px] bg-[#F9F9F9]">
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900 first:pl-6">Tag</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Dimension</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created by</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Assets</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900 last:pr-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTags.map((tag) => (
              <tr
                key={tag.id}
                className={`border-b border-gray-100 last:border-b-0 ${!tag.is_system ? 'hover:bg-gray-50/50 cursor-pointer' : 'opacity-75'}`}
                onClick={!tag.is_system ? () => router.push(`/tagging/${tag.id}`) : undefined}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {tag.label}
                </td>
                <td className="px-6 py-4 text-sm capitalize text-gray-600">
                  {tag.dimension_key 
                    ? tag.dimension_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    : tag.tag_type?.replace("_", " ") || "Unknown"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {tag.users?.full_name || formatDate(tag.created_at, "short")}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{tag.asset_count || 0}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {tag.is_system ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-gray-500 cursor-help">
                            <Info className="h-4 w-4" />
                            <span>Read-only</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>System tags can only be edited from the system admin area</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <Link href={`/tagging/${tag.id}`} onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </Button>
                        </Link>
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </TooltipProvider>

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

      {/* Pagination - Fixed in bottom right corner */}
      {filteredTags.length > 0 && (
        <div className="fixed bottom-8 right-8 flex items-center gap-4 z-10">
          <button
            className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={prevPage}
            disabled={isFirstPage}
            >
              <svg
                viewBox="0 8 25 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                style={{ transform: 'scaleX(-1)' }}
              >
                <path
                  d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                  stroke="black"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1 bg-[#E6E6E6] rounded-[30px] p-1">
                <button
                  onClick={() => goToPage(1)}
                  className={`flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === 1
                      ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                      : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  1
                </button>
                {totalPages > 2 && (
                  <>
                    {currentPage <= 2 ? (
                      <button
                        onClick={() => goToPage(2)}
                        className={`flex items-center justify-center transition-all cursor-pointer ${
                          currentPage === 2
                            ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                            : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        2
                      </button>
                    ) : (
                      <>
                        {currentPage > 3 && (
                          <>
                            <span className="h-8 w-8 flex items-center justify-center text-gray-400">...</span>
                          </>
                        )}
                        <button
                          onClick={() => goToPage(currentPage)}
                          className="h-9 w-9 rounded-full bg-white text-gray-900 flex items-center justify-center cursor-pointer"
                        >
                          {currentPage}
                        </button>
                      </>
                    )}
                    {totalPages > 3 && currentPage < totalPages && (
                      <>
                        {currentPage < totalPages - 1 && (
                          <span className="h-8 w-8 flex items-center justify-center text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => goToPage(totalPages)}
                          className={`flex items-center justify-center transition-all cursor-pointer ${
                            currentPage === totalPages
                              ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                              : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-gray-900">
                1
              </div>
            )}
            <button
              className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              onClick={nextPage}
              disabled={isLastPage}
            >
              <svg
                viewBox="0 8 25 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
              >
                <path
                  d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                  stroke="black"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        )}
    </div>
  )
}
