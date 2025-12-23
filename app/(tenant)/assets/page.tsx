"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, Search, Heart, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Card, CardHeader } from "@/components/ui/card"
import { AssetPreview } from "@/components/asset-preview"
import { FilterPanel } from "@/components/filter-panel"
import { CollectionCard } from "@/components/collection-card"
import { AssetGridSkeleton, CollectionGridSkeleton, SectionHeaderSkeleton } from "@/components/skeleton-loaders"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
  created_at: string
  file_size: number
  current_version?: {
    thumbnail_path: string | null
  } | null
}

interface Collection {
  id: string
  label: string
  slug: string
  assetCount: number
  previewAssets: Asset[]
}

export default function AssetsPage() {
  const { tenant } = useTenant()
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [collectionSort, setCollectionSort] = useState("newest")
  const [isLoading, setIsLoading] = useState(true) // Start with loading true to show skeletons immediately
  const [signedUrlsCache, setSignedUrlsCache] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabaseRef = useRef(createClient())



  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])


  const loadData = async () => {
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    const supabase = supabaseRef.current

    // Fetch assets
    const { data: assetsData } = await supabase
      .from("assets")
      .select(`
        id,
        title,
        storage_path,
        mime_type,
        created_at,
        file_size,
        current_version:asset_versions!current_version_id (
          thumbnail_path
        )
      `)
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    // Set assets data
    setAssets(assetsData || [])
    setFilteredAssets(assetsData || [])

    // Load dimensions that generate collections
    const { data: dimensions } = await supabase
      .from("tag_dimensions")
      .select("*")
      .eq("generates_collection", true)
      .order("display_order", { ascending: true })

    if (!dimensions || dimensions.length === 0) {
      setCollections([])
      setFilteredCollections([])
    } else {
      // Build collections for each dimension
      const allCollections: Collection[] = []

      for (const dimension of dimensions) {
        // Get parent tag if hierarchical
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

        // Get tags for this dimension
        const query = supabase
          .from("tags")
          .select("id, label, slug")
          .eq("dimension_key", dimension.dimension_key)
          .or(`client_id.eq.${clientId},client_id.is.null`)
          .order("sort_order", { ascending: true })

        if (dimension.is_hierarchical && parentTagId) {
          query.eq("parent_id", parentTagId)
        } else if (dimension.is_hierarchical) {
          query.is("parent_id", null)
        }

        const { data: tags } = await query

        if (!tags || tags.length === 0) continue

        // Get asset-tag relationships for this dimension
        const { data: assetTags } = await supabase
          .from("asset_tags")
          .select("asset_id, tag_id")
          .in("tag_id", tags.map((t: any) => t.id))

        // Build map of tag_id -> asset_ids
        const tagAssetMap = new Map<string, string[]>()
        assetTags?.forEach((at: any) => {
          const current = tagAssetMap.get(at.tag_id) || []
          tagAssetMap.set(at.tag_id, [...current, at.asset_id])
        })

        // Create collections for each tag
        const dimensionCollections = tags
          .map((tag: any) => {
            const assetIds = tagAssetMap.get(tag.id) || []
            const tagAssets = (assetsData || []).filter((a: Asset) => assetIds.includes(a.id))

            return {
              id: tag.id,
              label: tag.label,
              slug: tag.slug,
              assetCount: tagAssets.length,
              previewAssets: tagAssets.slice(0, 4).map((asset: Asset) => ({
                ...asset,
                thumbnail_path: asset.current_version?.thumbnail_path || null
              })),
            }
          })
          .filter((c: Collection) => c.assetCount > 0)

        allCollections.push(...dimensionCollections)
      }

      setCollections(allCollections)
      setFilteredCollections(allCollections)
    }

    // Batch fetch signed URLs for all assets that need them
    const assetsWithMedia = assetsData.filter((asset: Asset) =>
      asset.mime_type?.startsWith("image/") ||
      asset.mime_type?.startsWith("video/") ||
      asset.mime_type === "application/pdf"
    )

    if (assetsWithMedia.length > 0) {
      try {
        const storagePaths = assetsWithMedia.map((a: Asset) => a.storage_path).filter(Boolean)

        const batchResponse = await fetch('/api/assets/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePaths })
        })

        if (batchResponse.ok) {
          const { signedUrls } = await batchResponse.json()
          setSignedUrlsCache(signedUrls)
        }
      } catch (error) {
        console.error('[ASSETS-PAGE] Error fetching signed URLs:', error)
      }
    }

    // Show content immediately - images will load individually with their own loading states
    // Add a fallback timeout in case something goes wrong
    setTimeout(() => setIsLoading(false), 100)

    // Also add a longer timeout as ultimate fallback
    setTimeout(() => setIsLoading(false), 10000)
  }

  const applySearchAndSort = () => {
    let filtered = [...assets]

    if (searchQuery) {
      filtered = filtered.filter((asset) => asset.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "name":
          return a.title.localeCompare(b.title)
        case "size":
          return b.file_size - a.file_size
        default:
          return 0
      }
    })

    setFilteredAssets(filtered)
  }

  const sortedCollections = [...filteredCollections].sort((a, b) => {
    switch (collectionSort) {
      case "newest":
        return b.assetCount - a.assetCount // Most assets first
      case "oldest":
        return a.assetCount - b.assetCount
      case "name":
        return a.label.localeCompare(b.label)
      default:
        return 0
    }
  })

  const handleApplyFilters = async (filters: Record<string, string[]>) => {
    // filters is now: { dimension_key: tag_ids[] }
    const allSelectedTags = Object.values(filters).flat()

    const supabase = supabaseRef.current

    if (allSelectedTags.length === 0) {
      // No filters - show all
      setFilteredAssets(assets)
      setFilteredCollections(collections)
      setIsFilterOpen(false)
      return
    }

    // Get all assets that match the selected tags
    // For multi-dimensional filtering, we need assets that have ALL selected tags from each dimension
    // But can have ANY tag from different dimensions (AND within dimension, OR between dimensions)
    
    const dimensionKeys = Object.keys(filters)
    let matchingAssetIds: Set<string> | null = null

    for (const dimensionKey of dimensionKeys) {
      const tagIds = filters[dimensionKey]
      if (tagIds.length === 0) continue

      // Get assets that have any of these tags for this dimension
      const { data: assetTags } = await supabase
        .from("asset_tags")
        .select("asset_id, tag_id, tags!inner(dimension_key)")
        .in("tag_id", tagIds)
        .eq("tags.dimension_key", dimensionKey)

      const assetIdsForDimension = new Set<string>(
        assetTags?.map((at: any) => at.asset_id as string) || []
      )

      if (matchingAssetIds === null) {
        // First dimension - initialize with these assets
        matchingAssetIds = assetIdsForDimension
      } else {
        // Intersect with previous results (AND logic between dimensions)
        matchingAssetIds = new Set(
          [...matchingAssetIds].filter((id) => assetIdsForDimension.has(id))
        )
      }
    }

    // Filter assets
    const filteredAssets = matchingAssetIds
      ? assets.filter((asset) => matchingAssetIds!.has(asset.id))
      : []

    // Filter collections based on filtered assets
    // Get campaign tags from filtered assets
    const { data: filteredAssetTags } = await supabase
      .from("asset_tags")
      .select("tag_id, tags!inner(dimension_key)")
      .in("asset_id", filteredAssets.map((a) => a.id))
      .eq("tags.dimension_key", "campaign")

    const campaignTagIds = new Set(
      filteredAssetTags?.map((at: any) => at.tag_id) || []
    )

    const filteredCollectionsResult = collections.filter((collection) =>
      campaignTagIds.has(collection.id)
    )

    setFilteredAssets(filteredAssets)
    setFilteredCollections(filteredCollectionsResult)
    setIsFilterOpen(false)
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Assets library</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsFilterOpen(true)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Search assets"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{filteredCollections.length} Collections</h2>
            <button
              onClick={() => router.push('/assets/collections')}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              See all collections →
            </button>
          </div>
          <Select value={collectionSort} onValueChange={setCollectionSort}>
            <SelectTrigger className="w-[200px]" suppressHydrationWarning>
              <SelectValue placeholder="Sort collections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort collections by Newest</SelectItem>
              <SelectItem value="name">Sort collections by Name</SelectItem>
              <SelectItem value="oldest">Sort collections by Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredCollections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No collections yet. Upload assets with category tags to create collections.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6">
            {sortedCollections.map((collection, index) => (
              <div
                key={collection.id}
                className="animate-stagger-fade-in"
                style={{
                  animationDelay: `${Math.min(index * 20, 300)}ms`,
                }}
              >
                <CollectionCard
                  id={collection.id}
                  label={collection.label}
                  assetCount={collection.assetCount}
                  previewAssets={collection.previewAssets}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assets Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {filteredAssets.length} Asset{filteredAssets.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px]" suppressHydrationWarning>
              <SelectValue placeholder="Sort assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort assets by Newest</SelectItem>
              <SelectItem value="oldest">Sort assets by Oldest</SelectItem>
              <SelectItem value="name">Sort assets by Name</SelectItem>
              <SelectItem value="size">Sort assets by Size</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600">No assets found</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {filteredAssets.map((asset, index) => {
              // Always render assets, but control animation timing
              // Use inline style for opacity to ensure it works with animation
              return (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}?context=all`}
                className="block break-inside-avoid animate-stagger-fade-in"
                style={{
                  animationDelay: `${Math.min(index * 15, 200)}ms`,
                }}
              >
                <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg mb-6">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 aspect-square">
                    {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path && (
                      <AssetPreview
                        storagePath={asset.storage_path}
                        mimeType={asset.mime_type}
                        alt={asset.title}
                        className={asset.mime_type === "application/pdf" ? "w-full h-full object-contain" : "w-full h-full object-cover"}
                        signedUrl={signedUrlsCache[asset.storage_path]} // Pass cached signed URL if available
                        showLoading={false}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-white/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
              )
            })}
          </div>
        )}
      </div>

      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onApplyFilters={handleApplyFilters} />

    </div>
  )
}
