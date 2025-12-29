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
import { EmptyState } from "@/components/empty-state"
import { FolderOpen } from "lucide-react"
import { AssetGridSkeleton, CollectionGridSkeleton, SectionHeaderSkeleton } from "@/components/skeleton-loaders"
import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { getActiveAssetsForClient, getCollectionDimensions } from "@/lib/utils/supabase-queries"
import type { Collection } from "@/lib/utils/collections"
import { useLocalStorageCache } from "@/hooks/use-local-storage-cache"

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

interface AssetTag {
  asset_id: string
  tag_id: string
  tags?: {
    dimension_key: string
  }
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
  const [isLoadingCollections, setIsLoadingCollections] = useState(true) // Separate loading state for collections
  const [signedUrlsCache, setSignedUrlsCache] = useState<Record<string, string>>({})
  const [collectionsToShow, setCollectionsToShow] = useState(4) // Max 4 collections
  const [collectionsReady, setCollectionsReady] = useState(false) // Track when collections are ready to animate
  const [assetsReady, setAssetsReady] = useState(false) // Track when assets are ready to animate
  const [isUsingCachedData, setIsUsingCachedData] = useState(false) // Track if we're using cached data
  const [tenantReady, setTenantReady] = useState(false) // Track when tenant is ready
  const router = useRouter()
  const supabaseRef = useRef(createClient())




  // Cache helper functions - hook must be called unconditionally per React rules
  const { getCachedData, setCachedData } = useLocalStorageCache('assets_cache')

  // Wait for tenant to be fully ready before proceeding
  useEffect(() => {
    if (tenant?.id) {
      setTenantReady(true)
    } else {
      setTenantReady(false)
    }
  }, [tenant?.id])

  useEffect(() => {
    // Only load data when tenant is confirmed ready
    if (!tenantReady || !tenant?.id) {
      return
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantReady, tenant?.id])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])

  const loadData = async () => {
    // Use tenant from context - tenant layout already verified access
    // Guard against tenant not being ready
    if (!tenant?.id) {
      setIsLoading(false)
      setIsLoadingCollections(false)
      return
    }
    
    try {
      const clientId = tenant.id

      // Try to load from cache first - only if tenant is ready
      const cachedAssets = getCachedData<Asset[]>('assets')
      const cachedDimensions = getCachedData<any[]>('dimensions')
      const cachedCollections = getCachedData<Collection[]>('collections')

    if (cachedAssets && cachedDimensions) {
      // Use cached data - show immediately
      setAssets(cachedAssets)
      setFilteredAssets(cachedAssets)
      setIsLoading(false)
      setIsUsingCachedData(true) // Mark that we're using cached data
      
      // Show assets and collections immediately when using cache (no animation delays)
      setAssetsReady(true)
      
      // Load collections from cache if available
      if (cachedCollections) {
        setCollections(cachedCollections)
        setFilteredCollections(cachedCollections)
        setIsLoadingCollections(false)
        setCollectionsToShow(Math.min(cachedCollections.length, 4))
        // Mark collections as ready immediately (no delay for cached data)
        setCollectionsReady(true)
      } else if (cachedDimensions && cachedDimensions.length > 0) {
        // Build collections from cached dimensions and assets
        setIsLoadingCollections(true)
        const supabase = supabaseRef.current
        ;(async () => {
          const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
          const allCollections = await loadCollectionsFromDimensions(
            supabase,
            cachedDimensions,
            clientId,
            cachedAssets as any // Type assertion needed due to cached data structure differences
          )
          setCachedData('collections', allCollections)
          setCollections(allCollections)
          setFilteredCollections(allCollections)
          setIsLoadingCollections(false)
          setCollectionsToShow(Math.min(allCollections.length, 4))
          // Mark collections as ready immediately when built from cache
          setCollectionsReady(true)
        })()
      } else {
        setIsLoadingCollections(true)
      }
      
      // Refresh in background (don't await)
      refreshDataInBackground(clientId)
      return
    }

    // No cache - load from database
    setIsUsingCachedData(false) // Reset flag when loading fresh data
    await refreshDataFromDatabase(clientId)
    } catch (error) {
      // Handle any errors during data loading
      console.error('[ASSETS-PAGE] Error loading data:', error)
      setIsLoading(false)
      setIsLoadingCollections(false)
    }
  }

  const refreshDataInBackground = async (clientId: string) => {
    // Refresh data in background without blocking UI
    const supabase = supabaseRef.current
    
    const [
      { data: assetsData, error: assetsError },
      { data: dimensions }
    ] = await Promise.all([
      getActiveAssetsForClient(supabase, clientId, {
        columns: `
          id,
          title,
          storage_path,
          mime_type,
          created_at,
          file_size,
          current_version:asset_versions!current_version_id (
            thumbnail_path
          )
        `,
        orderBy: "created_at",
        ascending: false,
        limit: 1000,
      }),
      getCollectionDimensions(supabase)
    ])

    if (!assetsError && assetsData) {
      const allAssets = assetsData || []
      
      // Only update state if data actually changed to prevent unnecessary re-renders
      setAssets(prevAssets => {
        // Compare by length and first item ID to avoid unnecessary updates
        if (prevAssets.length === allAssets.length && 
            prevAssets.length > 0 && 
            prevAssets[0]?.id === allAssets[0]?.id) {
          return prevAssets // No change, return previous to prevent re-render
        }
        // Data changed - update cache and filtered assets
        setCachedData('assets', allAssets)
        setCachedData('dimensions', dimensions || [])
        setFilteredAssets(allAssets)
        return allAssets
      })
      
      // Build collections in background only if dimensions exist and collections aren't already loaded
      if (dimensions && dimensions.length > 0) {
        setCollections(prevCollections => {
          if (prevCollections.length > 0) {
            return prevCollections // Already loaded, don't rebuild
          }
          
          // Build collections asynchronously
          ;(async () => {
            const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
            const allCollections = await loadCollectionsFromDimensions(
              supabase,
              dimensions,
              clientId,
              allAssets as any // Type assertion needed due to cached data structure differences
            )
            setCachedData('collections', allCollections)
            setCollections(allCollections)
            setFilteredCollections(allCollections)
            setIsLoadingCollections(false)
            setCollectionsToShow(Math.min(allCollections.length, 4))
            // Mark collections as ready for animation
            setTimeout(() => setCollectionsReady(true), 50)
          })()
          
          return prevCollections
        })
      }
    }
  }

  const refreshDataFromDatabase = async (clientId: string) => {
    const supabase = supabaseRef.current

    // Load assets and dimensions in parallel
    // For small datasets (< 1000), use simple query instead of pagination
    const [
      { data: assetsData, error: assetsError },
      { data: dimensions }
    ] = await Promise.all([
      getActiveAssetsForClient(supabase, clientId, {
        columns: `
          id,
          title,
          storage_path,
          mime_type,
          created_at,
          file_size,
          current_version:asset_versions!current_version_id (
            thumbnail_path
          )
        `,
        orderBy: "created_at",
        ascending: false,
        limit: 1000, // Supabase default limit - sufficient for most cases
      }),
      getCollectionDimensions(supabase)
    ])

    if (assetsError) {
      console.error("Error loading assets:", assetsError)
      setIsLoading(false)
      setIsLoadingCollections(false)
      return
    }

    // Set assets data immediately and show content
    const allAssets = assetsData || []
    
    // Cache the data
    setCachedData('assets', allAssets)
    setCachedData('dimensions', dimensions || [])
    
    setAssets(allAssets)
    setFilteredAssets(allAssets)
    setIsLoading(false) // Show assets immediately
      // Mark assets as ready for animation after collections have started
      const collectionsCount = collections.length > 0 ? collections.length : 4
      const collectionsAnimationDuration = Math.min(collectionsCount * 25, 200) + 200 // Reduced buffer for faster loading
      setTimeout(() => setAssetsReady(true), collectionsAnimationDuration)

    if (!dimensions || dimensions.length === 0) {
      setCollections([])
      setFilteredCollections([])
      setIsLoadingCollections(false)
    } else {
      // Build collections for each dimension - load asynchronously in background (don't await)
      // IMPORTANT: Pass allAssets to ensure collections have access to ALL assets, not just first 1000
      ;(async () => {
        const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
        const allCollections = await loadCollectionsFromDimensions(
          supabase,
          dimensions,
          clientId,
          allAssets
        )

        // Cache and update collections when ready - batch state updates
        setCachedData('collections', allCollections)
        setCollections(allCollections)
        setFilteredCollections(allCollections)
        setIsLoadingCollections(false)
        // Set how many collections to show (max 4)
        setCollectionsToShow(Math.min(allCollections.length, 4))
        // Mark collections as ready for animation
        setTimeout(() => setCollectionsReady(true), 50)
      })()
    }

    // Batch fetch signed URLs for all assets that need them (in background, don't block UI)
    const assetsWithMedia = (assetsData || []).filter((asset: Asset) =>
      asset.mime_type?.startsWith("image/") ||
      asset.mime_type?.startsWith("video/") ||
      asset.mime_type === "application/pdf"
    )

    if (assetsWithMedia.length > 0) {
      // Use assetIds for faster lookup instead of storagePaths
      const assetIds = assetsWithMedia.map((a: Asset) => a.id).filter(Boolean)
      
      // Fetch signed URLs in background - don't await, let it load asynchronously
      fetch('/api/assets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds })
      })
        .then(response => {
          if (response.ok) {
            return response.json()
          }
          throw new Error('Batch API failed')
        })
        .then(({ signedUrls }) => {
          if (signedUrls) {
            setSignedUrlsCache(signedUrls)
          }
        })
        .catch((error) => {
          console.error('[ASSETS-PAGE] Error fetching signed URLs:', error)
        })
    }
  }

  const applySearchAndSort = () => {
    const { filterBySearch, sortItems } = require("@/lib/utils/sorting")
    let filtered = filterBySearch(assets, searchQuery, ["title"])
    filtered = sortItems(filtered, sortBy as "newest" | "oldest" | "name" | "size")
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
        assetTags?.map((at: AssetTag) => at.asset_id) || []
      )

      if (matchingAssetIds === null) {
        // First dimension - initialize with these assets
        matchingAssetIds = assetIdsForDimension
      } else {
        // Intersect with previous results (AND logic between dimensions)
        const matchingArray = Array.from(matchingAssetIds) as string[]
        matchingAssetIds = new Set(
          matchingArray.filter((id: string) => assetIdsForDimension.has(id))
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
      filteredAssetTags?.map((at: AssetTag) => at.tag_id) || []
    )

    const filteredCollectionsResult = collections.filter((collection) =>
      campaignTagIds.has(collection.id)
    )

    setFilteredAssets(filteredAssets)
    setFilteredCollections(filteredCollectionsResult)
    setIsFilterOpen(false)
  }

  // Don't render until tenant is ready to prevent server-side rendering issues
  // This ensures tenant context is fully initialized before rendering
  if (!tenantReady || !tenant?.id) {
    return (
      <>
        <div className="mx-auto w-full max-w-7xl">
          <div className="p-4 sm:p-8">
            <AssetGridSkeleton count={12} />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl">
        {/* Header Section */}
        <div className="p-4 sm:p-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Assets library</h1>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button variant="secondary" onClick={() => setIsFilterOpen(true)} className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
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
        </div>

        {/* Collections Section - Full Width */}
        <div className="mb-10 relative px-4 sm:px-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {isLoadingCollections ? "Loading..." : `${filteredCollections.length} Collections`}
            </h2>
            <button
              onClick={() => router.push('/assets/collections')}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer hidden sm:inline"
            >
              See all collections →
            </button>
          </div>
          <Select value={collectionSort} onValueChange={setCollectionSort}>
            <SelectTrigger className="w-full sm:w-[200px]" suppressHydrationWarning>
              <SelectValue placeholder="Sort collections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort collections by Newest</SelectItem>
              <SelectItem value="name">Sort collections by Name</SelectItem>
              <SelectItem value="oldest">Sort collections by Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoadingCollections ? (
          <CollectionGridSkeleton count={4} />
        ) : filteredCollections.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No collections yet"
            description="Upload assets with collection-generating tags to create collections."
          />
        ) : (
          <div className="gap-4 sm:gap-6 grid grid-cols-2 xl:grid-cols-4">
            {sortedCollections.slice(0, collectionsToShow).map((collection, index) => (
              <div
                key={collection.id}
                className={isUsingCachedData ? "w-full" : (collectionsReady ? "animate-stagger-fade-in w-full" : "opacity-0 w-full")}
                style={!isUsingCachedData && collectionsReady ? {
                  animationDelay: `${Math.min(index * 25, 200)}ms`,
                } : {}}
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
        <div className="px-4 sm:px-8">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {filteredAssets.length} Asset{filteredAssets.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[200px]" suppressHydrationWarning>
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

          {isLoading ? (
            <AssetGridSkeleton count={12} />
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-600">No assets found</p>
            </div>
          ) : (
            <div className="gap-4 sm:gap-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredAssets.map((asset, index) => {
                const hasMedia = (asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path
                
                // Smooth staggered loading only when loading fresh data
                // If data is from cache, show immediately without delays
                const collectionsCount = collectionsToShow
                const collectionsAnimationDuration = isUsingCachedData ? 0 : Math.min(collectionsCount * 25, 200) + 200
                const assetDelay = isUsingCachedData ? 0 : collectionsAnimationDuration + (index * 15)
                
                return (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}?context=all`}
                  className={isUsingCachedData ? "w-full" : (assetsReady ? "animate-stagger-fade-in w-full" : "opacity-0 w-full")}
                  style={!isUsingCachedData && assetsReady ? {
                    animationDelay: `${Math.min(assetDelay, collectionsAnimationDuration + 300)}ms`,
                  } : {}}
                >
                  <Card className="group overflow-hidden p-0 transition-shadow w-full" style={{ borderRadius: '20px' }}>
                    <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 w-full" style={{ aspectRatio: '1 / 1', borderRadius: '20px' }}>
                      {hasMedia && (
                        <AssetPreview
                          storagePath={asset.storage_path}
                          mimeType={asset.mime_type}
                          alt={asset.title}
                          className={asset.mime_type === "application/pdf" ? "w-full h-full object-contain absolute inset-0" : "w-full h-full object-cover absolute inset-0"}
                          style={{ borderRadius: '20px' }}
                          signedUrl={signedUrlsCache[asset.storage_path]} // Pass cached signed URL if available
                          showLoading={false}
                        />
                      )}
                      {!hasMedia && (
                        // For assets without media, mark as loaded immediately
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200" style={{ borderRadius: '20px' }}>
                          <span className="text-gray-400 text-sm">No preview</span>
                        </div>
                      )}
                      <button
                        className="absolute bottom-2 right-2 h-[48px] w-[48px] rounded-full opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center"
                        style={{
                          backgroundColor: '#E5E5E5',
                        }}
                      >
                        <svg
                          viewBox="0 8 25 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          preserveAspectRatio="xMidYMid"
                          style={{
                            width: '22px',
                            height: '18px',
                          }}
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
                  </Card>
                </Link>
              )
              })}
            </div>
          )}
        </div>
      </div>

      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onApplyFilters={handleApplyFilters} />

    </>
  )
}
