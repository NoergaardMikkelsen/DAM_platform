"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Pencil, Trash2, Plus, Tag, Layers, Search } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ListPageHeaderSkeleton, SearchSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { usePagination } from "@/hooks/use-pagination"
import { PAGINATION } from "@/lib/constants"
import { formatDate } from "@/lib/utils/date"
import { useSearchFilter } from "@/hooks/use-search-filter"
import { logError } from "@/lib/utils/logger"
import { EmptyState } from "@/components/empty-state"
import { TablePage, TableColumn } from "@/components/table-page"
import { createSystemTag } from "@/lib/utils/tag-creation"
import type { TagDimension } from "@/lib/types/database"
import { generateSlug } from "@/lib/utils/slug"

interface SystemTag {
  id: string
  label: string
  slug: string
  dimension_key: string | null
  parent_id: string | null
  is_system: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  users?: {
    full_name: string
  } | null
  asset_count?: number
  dimension?: {
    label: string
  } | null
}

export default function SystemTagsPage() {
  const [tags, setTags] = useState<SystemTag[]>([])
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [dimensionFilter, setDimensionFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createTagLoading, setCreateTagLoading] = useState(false)
  const [createTagForm, setCreateTagForm] = useState({
    label: '',
    dimensionKey: '',
  })
  const [createTagError, setCreateTagError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<SystemTag | null>(null)
  const [editTagForm, setEditTagForm] = useState({
    label: '',
    dimensionKey: '',
    sortOrder: 0,
  })
  const [editTagLoading, setEditTagLoading] = useState(false)
  const [editTagError, setEditTagError] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<SystemTag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreateDimensionModalOpen, setIsCreateDimensionModalOpen] = useState(false)
  const [createDimensionLoading, setCreateDimensionLoading] = useState(false)
  const [createDimensionForm, setCreateDimensionForm] = useState({
    label: '',
    dimensionKey: '',
    isHierarchical: false,
    requiresSubtag: false,
    allowsMultiple: true,
    required: false,
    displayOrder: 0,
    generatesCollection: false,
    allowUserCreation: true,
  })
  const [createDimensionError, setCreateDimensionError] = useState<string | null>(null)
  const [isDeleteDimensionDialogOpen, setIsDeleteDimensionDialogOpen] = useState(false)
  const [dimensionToDelete, setDimensionToDelete] = useState<TagDimension | null>(null)
  const [isDeletingDimension, setIsDeletingDimension] = useState(false)
  const [activeTab, setActiveTab] = useState<"tags" | "dimensions">("tags")
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
  const [dimensionSearchQuery, setDimensionSearchQuery] = useState("")

  // Apply dimension filter on top of search filter
  const filteredTags = dimensionFilter === "all"
    ? searchFilteredTags
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
    loadDimensions()
  }, [])

  const loadTags = async () => {
    try {
      setIsLoading(true)
      const supabase = supabaseRef.current

      // Load all system tags (client_id IS NULL, is_system = true)
      // This includes all existing system tags that are visible across all tenants
      // Query matches both conditions to ensure we get all system tags
      // Note: Supabase has a default limit of 1000, so we explicitly set a high limit
      // to fetch all system tags. If there are more than 10000 tags, we'd need batch fetching.
      let allTagsData: any[] = []
      let from = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        // First, get the tags without joins to ensure we get all data
        const { data: tagsData, error: tagsError } = await supabase
          .from("tags")
          .select(`
            id,
            label,
            slug,
            dimension_key,
            parent_id,
            is_system,
            sort_order,
            created_by,
            created_at,
            updated_at
          `)
          .is("client_id", null)
          .eq("is_system", true)
          .order("dimension_key", { ascending: true, nullsFirst: false })
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true })
          .range(from, from + batchSize - 1)

        if (tagsError) {
          console.error("[SYSTEM-TAGS] Failed to load system tags (batch starting at", from, "):", tagsError)
          logError("Failed to load system tags", tagsError)
          // If error on first batch, return early
          if (from === 0) {
            setTags([])
            setIsLoading(false)
            return
          }
          // Otherwise break and use what we have
          break
        }

        if (!tagsData) {
          console.warn("[SYSTEM-TAGS] No data returned for batch starting at", from)
          hasMore = false
        } else if (tagsData.length === 0) {
          hasMore = false
        } else {
          console.log(`[SYSTEM-TAGS] Loaded batch: ${tagsData.length} tags (from ${from} to ${from + tagsData.length - 1})`)
          allTagsData = [...allTagsData, ...tagsData]
          // If we got fewer than batchSize, we've reached the end
          if (tagsData.length < batchSize) {
            hasMore = false
          } else {
            from += batchSize
          }
        }
      }

      console.log(`[SYSTEM-TAGS] Loaded ${allTagsData.length} system tags`)

      if (allTagsData.length === 0) {
        console.warn("[SYSTEM-TAGS] No system tags found. This might be expected if no system tags exist yet.")
        setTags([])
        setIsLoading(false)
        return
      }

      // Get user names and dimension labels separately to avoid join issues
      const userIds = [...new Set(allTagsData.map(tag => tag.created_by).filter(Boolean))]
      const dimensionKeys = [...new Set(allTagsData.map(tag => tag.dimension_key).filter(Boolean))]

      const usersMap = new Map<string, { full_name: string }>()
      const dimensionsMap = new Map<string, { label: string }>()

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", userIds)
        
        usersData?.forEach(user => {
          usersMap.set(user.id, { full_name: user.full_name })
        })
      }

      if (dimensionKeys.length > 0) {
        const { data: dimensionsData } = await supabase
          .from("tag_dimensions")
          .select("dimension_key, label")
          .in("dimension_key", dimensionKeys)
        
        dimensionsData?.forEach(dim => {
          dimensionsMap.set(dim.dimension_key, { label: dim.label })
        })
      }

      // Get asset counts for each tag and combine with user/dimension data
      const tagsWithCounts = await Promise.all(
        allTagsData.map(async (tag) => {
          const { count } = await supabase
            .from("asset_tags")
            .select("*", { count: "exact", head: true })
            .eq("tag_id", tag.id)

          return {
            ...tag,
            asset_count: count || 0,
            users: tag.created_by ? usersMap.get(tag.created_by) || null : null,
            dimension: tag.dimension_key ? dimensionsMap.get(tag.dimension_key) || null : null,
          }
        })
      )

      console.log(`[SYSTEM-TAGS] Processed ${tagsWithCounts.length} tags with asset counts`)
      setTags(tagsWithCounts)
    } catch (error) {
      console.error("[SYSTEM-TAGS] Error loading system tags:", error)
      logError("Error loading system tags", error)
      setTags([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadDimensions = async () => {
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from("tag_dimensions")
      .select("*")
      .order("display_order")

    setDimensions(data || [])
  }

  const handleCreateDimension = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateDimensionLoading(true)
    setCreateDimensionError(null)

    try {
      const supabase = supabaseRef.current
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("Not authenticated")
      }

      if (!createDimensionForm.label.trim()) {
        throw new Error("Dimension label is required")
      }

      // Generate dimension_key from label (slug format)
      const dimensionKey = generateSlug(createDimensionForm.label.trim())

      // Check if dimension already exists
      const { data: existing } = await supabase
        .from("tag_dimensions")
        .select("dimension_key")
        .eq("dimension_key", dimensionKey)
        .maybeSingle()

      if (existing) {
        throw new Error("A dimension with this key already exists")
      }

      // Get max display_order to place new dimension at the end
      const { data: maxOrderData } = await supabase
        .from("tag_dimensions")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)

      const maxDisplayOrder = maxOrderData && maxOrderData.length > 0 
        ? maxOrderData[0].display_order + 1 
        : (createDimensionForm.displayOrder || 1)

      // Create dimension
      const { data: newDimension, error: dimensionError } = await supabase
        .from("tag_dimensions")
        .insert({
          dimension_key: dimensionKey,
          label: createDimensionForm.label.trim(),
          is_hierarchical: createDimensionForm.isHierarchical,
          requires_subtag: createDimensionForm.requiresSubtag,
          allows_multiple: createDimensionForm.allowsMultiple,
          required: createDimensionForm.required,
          display_order: maxDisplayOrder,
          generates_collection: createDimensionForm.generatesCollection,
          allow_user_creation: createDimensionForm.allowUserCreation,
        })
        .select()
        .single()

      if (dimensionError) {
        throw dimensionError
      }

      // If hierarchical, create parent tag automatically
      if (createDimensionForm.isHierarchical && newDimension) {
        const parentTagId = await createSystemTag(supabase, {
          label: createDimensionForm.label.trim(),
          dimensionKey: dimensionKey,
          userId: user.id,
          dimension: newDimension,
          parentId: null, // Explicitly set to null for parent tag
          sortOrder: 0,
        })

        if (!parentTagId) {
          console.warn("Failed to create parent tag for hierarchical dimension")
        }
      }

      // Reset form and reload dimensions
      setCreateDimensionForm({
        label: '',
        dimensionKey: '',
        isHierarchical: false,
        requiresSubtag: false,
        allowsMultiple: true,
        required: false,
        displayOrder: 0,
        generatesCollection: false,
        allowUserCreation: true,
      })
      setIsCreateDimensionModalOpen(false)
      await loadDimensions()
      await loadTags() // Reload tags in case parent tag was created
    } catch (error) {
      setCreateDimensionError(error instanceof Error ? error.message : "Failed to create dimension")
      logError("Error creating dimension", error)
    } finally {
      setCreateDimensionLoading(false)
    }
  }

  const handleDeleteDimension = async () => {
    if (!dimensionToDelete) return

    setIsDeletingDimension(true)
    try {
      const supabase = supabaseRef.current

      // Check if dimension has associated tags
      const { data: tagsInDimension, error: tagsError } = await supabase
        .from("tags")
        .select("id")
        .eq("dimension_key", dimensionToDelete.dimension_key)
        .limit(1)

      if (tagsError) {
        throw tagsError
      }

      if (tagsInDimension && tagsInDimension.length > 0) {
        throw new Error(`Cannot delete dimension. It has ${tagsInDimension.length} tag(s) associated. Please delete all tags in this dimension first.`)
      }

      // Delete dimension
      const { error: deleteError } = await supabase
        .from("tag_dimensions")
        .delete()
        .eq("dimension_key", dimensionToDelete.dimension_key)

      if (deleteError) {
        throw deleteError
      }

      setIsDeleteDimensionDialogOpen(false)
      setDimensionToDelete(null)
      await loadDimensions()
    } catch (error) {
      logError("Error deleting dimension", error)
      alert(error instanceof Error ? error.message : "Failed to delete dimension")
    } finally {
      setIsDeletingDimension(false)
    }
  }

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateTagLoading(true)
    setCreateTagError(null)

    try {
      const supabase = supabaseRef.current
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("Not authenticated")
      }

      if (!createTagForm.label.trim()) {
        throw new Error("Tag label is required")
      }

      if (!createTagForm.dimensionKey) {
        throw new Error("Dimension is required")
      }

      const selectedDimension = dimensions.find(d => d.dimension_key === createTagForm.dimensionKey)
      if (!selectedDimension) {
        throw new Error("Invalid dimension selected")
      }

      // Create system tag
      const tagId = await createSystemTag(supabase, {
        label: createTagForm.label.trim(),
        dimensionKey: createTagForm.dimensionKey,
        userId: user.id,
        dimension: selectedDimension,
      })

      if (!tagId) {
        throw new Error("Failed to create system tag. Tag may already exist.")
      }

      // Reset form and reload tags
      setCreateTagForm({ label: '', dimensionKey: '' })
      setIsCreateModalOpen(false)
      await loadTags()
    } catch (error) {
      setCreateTagError(error instanceof Error ? error.message : "Failed to create tag")
      logError("Error creating system tag", error)
    } finally {
      setCreateTagLoading(false)
    }
  }

  const handleEditTag = (tag: SystemTag) => {
    setEditingTag(tag)
    setEditTagForm({
      label: tag.label,
      dimensionKey: tag.dimension_key || '',
      sortOrder: tag.sort_order,
    })
    setIsEditModalOpen(true)
    setEditTagError(null)
  }

  const handleEditTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTag) return

    setEditTagLoading(true)
    setEditTagError(null)

    try {
      const supabase = supabaseRef.current

      if (!editTagForm.label.trim()) {
        throw new Error("Tag label is required")
      }

      // Generate new slug if label changed
      const newSlug = editTagForm.label !== editingTag.label
        ? generateSlug(editTagForm.label.trim())
        : editingTag.slug

      // Check if slug already exists (excluding current tag)
      if (newSlug !== editingTag.slug) {
        const { data: existing } = await supabase
          .from("tags")
          .select("id")
          .eq("slug", newSlug)
          .is("client_id", null)
          .eq("is_system", true)
          .neq("id", editingTag.id)
          .maybeSingle()

        if (existing) {
          throw new Error("A tag with this name already exists")
        }
      }

      // Update tag
      const { error: updateError } = await supabase
        .from("tags")
        .update({
          label: editTagForm.label.trim(),
          slug: newSlug,
          sort_order: editTagForm.sortOrder,
        })
        .eq("id", editingTag.id)

      if (updateError) {
        throw updateError
      }

      // Reset form and reload tags
      setIsEditModalOpen(false)
      setEditingTag(null)
      await loadTags()
    } catch (error) {
      setEditTagError(error instanceof Error ? error.message : "Failed to update tag")
      logError("Error updating system tag", error)
    } finally {
      setEditTagLoading(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!tagToDelete) return

    setIsDeleting(true)
    try {
      const supabase = supabaseRef.current

      // Check if tag has associated assets
      const { count } = await supabase
        .from("asset_tags")
        .select("*", { count: "exact", head: true })
        .eq("tag_id", tagToDelete.id)

      if (count && count > 0) {
        throw new Error(`Cannot delete tag. It is associated with ${count} asset(s).`)
      }

      // Delete tag
      const { error: deleteError } = await supabase
        .from("tags")
        .delete()
        .eq("id", tagToDelete.id)

      if (deleteError) {
        throw deleteError
      }

      setIsDeleteDialogOpen(false)
      setTagToDelete(null)
      await loadTags()
    } catch (error) {
      logError("Error deleting system tag", error)
      alert(error instanceof Error ? error.message : "Failed to delete tag")
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: TableColumn<SystemTag>[] = [
    {
      header: "Label",
      render: (tag) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{tag.label}</span>
          {tag.parent_id && (
            <Badge variant="secondary" className="text-xs">Subtag</Badge>
          )}
        </div>
      ),
    },
    {
      header: "Dimension",
      render: (tag) => (
        <Badge variant="outline" className="max-w-[200px] truncate">
          {tag.dimension?.label || tag.dimension_key || "Legacy"}
        </Badge>
      ),
    },
    {
      header: "Assets",
      render: (tag) => tag.asset_count || 0,
    },
    {
      header: "Created",
      render: (tag) => formatDate(tag.created_at),
    },
    {
      header: "Created By",
      render: (tag) => tag.users?.full_name || "System",
    },
    {
      header: "Actions",
      render: (tag) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditTag(tag)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTagToDelete(tag)
              setIsDeleteDialogOpen(true)
            }}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const dimensionColumns: TableColumn<TagDimension>[] = [
    {
      header: "Label",
      render: (dim) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{dim.label}</div>
        </div>
      ),
    },
    {
      header: "Type",
      render: (dim) => (
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {dim.is_hierarchical && (
            <Badge variant="secondary" className="text-xs shrink-0 whitespace-nowrap">
              Hierarchical
            </Badge>
          )}
          {dim.generates_collection && (
            <Badge variant="secondary" className="text-xs shrink-0 whitespace-nowrap">
              Generates Collections
            </Badge>
          )}
          {!dim.is_hierarchical && !dim.generates_collection && (
            <span className="text-sm text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      header: "Settings",
      render: (dim) => (
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {dim.allows_multiple ? (
            <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">Multiple</Badge>
          ) : (
            <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">Single</Badge>
          )}
          {dim.allow_user_creation ? (
            <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">User creation</Badge>
          ) : (
            <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">Admin only</Badge>
          )}
        </div>
      ),
    },
    {
      header: "Display Order",
      render: (dim) => dim.display_order,
    },
    {
      header: "Actions",
      render: (dim) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDimensionToDelete(dim)
              setIsDeleteDimensionDialogOpen(true)
            }}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="p-8">
        <ListPageHeaderSkeleton />
        <SearchSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div className="p-8">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "tags" | "dimensions")}>
        <TabsContent value="tags" className="mt-0">
          <TablePage
        title="Tags & Dimensions"
        description="Manage system-wide tags and tag dimensions"
        search={{
          placeholder: "Search tags...",
          value: searchQuery,
          onChange: setSearchQuery,
          position: "below",
        }}
        tabs={{
          value: activeTab,
          onChange: (value) => setActiveTab(value as "tags" | "dimensions"),
          content: (
            <TabsList>
              <TabsTrigger value="tags">
                <Tag className="h-4 w-4 mr-2" />
                Tags
              </TabsTrigger>
              <TabsTrigger value="dimensions">
                <Layers className="h-4 w-4 mr-2" />
                Dimensions
              </TabsTrigger>
            </TabsList>
          ),
        }}
        createButton={{
          label: "Create System Tag",
          onClick: () => setIsCreateModalOpen(true),
        }}
        actions={
          <Select value={dimensionFilter} onValueChange={setDimensionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dimensions</SelectItem>
              {dimensions.map((dim) => (
                <SelectItem key={dim.dimension_key} value={dim.dimension_key}>
                  {dim.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        columns={columns}
        data={filteredTags}
        getRowKey={(tag) => tag.id}
        pagination={{
          currentPage,
          itemsPerPage,
          totalPages,
          paginatedItems: paginatedTags,
          goToPage,
          nextPage,
          prevPage,
          isFirstPage,
          isLastPage,
        }}
        emptyState={{
          icon: Tag,
          title: "No system tags",
          description: "Create your first system tag to get started.",
        }}
      >
        {/* Create Tag Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create System Tag</DialogTitle>
              <DialogDescription>
                Create a new system tag that will be available across all tenants.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTag} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Tag Label *</Label>
                <Input
                  id="label"
                  required
                  value={createTagForm.label}
                  onChange={(e) => setCreateTagForm({ ...createTagForm, label: e.target.value })}
                  placeholder="e.g., Campaign, Employee, Product"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dimensionKey">Dimension *</Label>
                <Select
                  value={createTagForm.dimensionKey}
                  onValueChange={(value) => setCreateTagForm({ ...createTagForm, dimensionKey: value })}
                  required
                >
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
              </div>
              {createTagError && (
                <div className="text-sm text-red-600">{createTagError}</div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTagLoading}>
                  {createTagLoading ? "Creating..." : "Create Tag"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </TablePage>
        </TabsContent>

        <TabsContent value="dimensions" className="mt-0">
          <TablePage
            title="Tags & Dimensions"
            description="Manage system-wide tags and tag dimensions"
            search={{
              placeholder: "Search dimensions...",
              value: dimensionSearchQuery,
              onChange: setDimensionSearchQuery,
              position: "below",
            }}
            tabs={{
              value: activeTab,
              onChange: (value) => setActiveTab(value as "tags" | "dimensions"),
              content: (
                <TabsList>
                  <TabsTrigger value="tags">
                    <Tag className="h-4 w-4 mr-2" />
                    Tags
                  </TabsTrigger>
                  <TabsTrigger value="dimensions">
                    <Layers className="h-4 w-4 mr-2" />
                    Dimensions
                  </TabsTrigger>
                </TabsList>
              ),
            }}
            createButton={{
              label: "Create Dimension",
              onClick: () => setIsCreateDimensionModalOpen(true),
            }}
            columns={dimensionColumns}
            data={dimensions.filter((dim) => 
              dimensionSearchQuery === "" || 
              dim.label.toLowerCase().includes(dimensionSearchQuery.toLowerCase()) ||
              dim.dimension_key.toLowerCase().includes(dimensionSearchQuery.toLowerCase())
            )}
            getRowKey={(dim) => dim.dimension_key}
            pagination={{
              currentPage: 1,
              itemsPerPage: dimensions.length,
              totalPages: 1,
              paginatedItems: dimensions,
              goToPage: () => {},
              nextPage: () => {},
              prevPage: () => {},
              isFirstPage: true,
              isLastPage: true,
            }}
            emptyState={{
              icon: Layers,
              title: "No dimensions found",
              description: "Create your first dimension to get started.",
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Tag Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit System Tag</DialogTitle>
            <DialogDescription>
              Update the system tag details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditTagSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editLabel">Tag Label *</Label>
              <Input
                id="editLabel"
                required
                value={editTagForm.label}
                onChange={(e) => setEditTagForm({ ...editTagForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSortOrder">Sort Order</Label>
              <Input
                id="editSortOrder"
                type="number"
                value={editTagForm.sortOrder}
                onChange={(e) => setEditTagForm({ ...editTagForm, sortOrder: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">
                Bestemmer rækkefølgen af tags inden for samme dimension. Lavere tal vises først. Tags med samme sort order sorteres alfabetisk.
              </p>
            </div>
            {editTagError && (
              <div className="text-sm text-red-600">{editTagError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editTagLoading}>
                {editTagLoading ? "Updating..." : "Update Tag"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dimension Modal */}
      <Dialog open={isCreateDimensionModalOpen} onOpenChange={setIsCreateDimensionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Tag Dimension</DialogTitle>
            <DialogDescription>
              Create a new tag dimension that defines a category of tags. Dimensions can be hierarchical or flat.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDimension} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dimLabel">Dimension Label *</Label>
              <Input
                id="dimLabel"
                required
                value={createDimensionForm.label}
                onChange={(e) => {
                  const label = e.target.value
                  setCreateDimensionForm({ 
                    ...createDimensionForm, 
                    label,
                    // Auto-generate dimension_key from label
                    dimensionKey: generateSlug(label)
                  })
                }}
                placeholder="e.g., Campaign, Visual Style"
              />
              <p className="text-xs text-gray-500">Display name for the dimension. Dimension key will be auto-generated.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={createDimensionForm.displayOrder}
                onChange={(e) => setCreateDimensionForm({ ...createDimensionForm, displayOrder: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">Determines order in UI. Will be set to end if not specified.</p>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isHierarchical"
                    checked={createDimensionForm.isHierarchical}
                    onCheckedChange={(checked) => setCreateDimensionForm({ ...createDimensionForm, isHierarchical: checked === true })}
                  />
                  <Label htmlFor="isHierarchical" className="font-normal cursor-pointer">
                    Hierarchical (has parent tag + child tags)
                  </Label>
                </div>
                {createDimensionForm.isHierarchical && (
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requiresSubtag"
                        checked={createDimensionForm.requiresSubtag}
                        onCheckedChange={(checked) => setCreateDimensionForm({ ...createDimensionForm, requiresSubtag: checked === true })}
                      />
                      <Label htmlFor="requiresSubtag" className="font-normal cursor-pointer">
                        Requires subtag (child tag must be selected)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="generatesCollection"
                        checked={createDimensionForm.generatesCollection}
                        onCheckedChange={(checked) => setCreateDimensionForm({ ...createDimensionForm, generatesCollection: checked === true })}
                      />
                      <Label htmlFor="generatesCollection" className="font-normal cursor-pointer">
                        Generates collections (child tags create collections)
                      </Label>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowsMultiple"
                    checked={createDimensionForm.allowsMultiple}
                    onCheckedChange={(checked) => setCreateDimensionForm({ ...createDimensionForm, allowsMultiple: checked === true })}
                  />
                  <Label htmlFor="allowsMultiple" className="font-normal cursor-pointer">
                    Allows multiple tags (can select multiple tags from this dimension)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="required"
                    checked={createDimensionForm.required}
                    onCheckedChange={(checked) => setCreateDimensionForm({ ...createDimensionForm, required: checked === true })}
                  />
                  <Label htmlFor="required" className="font-normal cursor-pointer">
                    Required (must select at least one tag from this dimension)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowUserCreation"
                    checked={createDimensionForm.allowUserCreation}
                    onCheckedChange={(checked) => setCreateDimensionForm({ ...createDimensionForm, allowUserCreation: checked === true })}
                  />
                  <Label htmlFor="allowUserCreation" className="font-normal cursor-pointer">
                    Allow user creation (users can create tags in this dimension)
                  </Label>
                </div>
              </div>
            </div>

            {createDimensionError && (
              <div className="text-sm text-red-600">{createDimensionError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateDimensionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createDimensionLoading}>
                {createDimensionLoading ? "Creating..." : "Create Dimension"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dimension Dialog */}
      <AlertDialog open={isDeleteDimensionDialogOpen} onOpenChange={setIsDeleteDimensionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag Dimension</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the dimension "{dimensionToDelete?.label}"? 
              This action cannot be undone.
              <br />
              <br />
              <strong>Note:</strong> You can only delete dimensions that have no associated tags. 
              Please delete all tags in this dimension first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDimension}
              disabled={isDeletingDimension}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingDimension ? "Deleting..." : "Delete Dimension"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete System Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{tagToDelete?.label}"? This action cannot be undone.
              {tagToDelete && tagToDelete.asset_count && tagToDelete.asset_count > 0 && (
                <span className="block mt-2 text-red-600">
                  Warning: This tag is associated with {tagToDelete.asset_count} asset(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

