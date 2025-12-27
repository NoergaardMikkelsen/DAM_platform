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
import { getAllActiveAssetsForClient, getCollectionDimensions } from "@/lib/utils/supabase-queries"
import type { Collection } from "@/lib/utils/collections"

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
  const [loadedAssets, setLoadedAssets] = useState<Set<string>>(new Set()) // Track which assets have loaded
  const [loadedCollectionCards, setLoadedCollectionCards] = useState<Set<string>>(new Set()) // Track which collection cards have loaded
  const [allContentLoaded, setAllContentLoaded] = useState(false) // Track if all content is loaded
  const [isDesktop, setIsDesktop] = useState(false) // Track if we're on desktop (lg breakpoint)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  // Check if we're on desktop (lg breakpoint = 1024px)
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])




  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])

  // Use refs to access current values in effects
  const filteredCollectionsRef = useRef(filteredCollections)
  const filteredAssetsRef = useRef(filteredAssets)
  
  useEffect(() => {
    filteredCollectionsRef.current = filteredCollections
  }, [filteredCollections])
  
  useEffect(() => {
    filteredAssetsRef.current = filteredAssets
  }, [filteredAssets])

  // Mark collections without preview assets as loaded immediately
  useEffect(() => {
    if (isLoadingCollections) {
      console.log(`[AssetsPage] Skipping collection marking - still loading collections`)
      return
    }
    
    console.log(`[AssetsPage] Checking collections for immediate marking. Total: ${filteredCollectionsRef.current.length}`)
    setLoadedCollectionCards(prev => {
      const updated = new Set(prev)
      let markedCount = 0
      filteredCollectionsRef.current.forEach(collection => {
        if (collection.previewAssets.length === 0 && !updated.has(collection.id)) {
          console.log(`[AssetsPage] Marking collection "${collection.label}" as loaded (no preview assets)`)
          updated.add(collection.id)
          markedCount++
        }
      })
      console.log(`[AssetsPage] Marked ${markedCount} collections without preview assets. Total loaded: ${updated.size}`)
      return updated
    })
  }, [filteredCollections.length, isLoadingCollections])

  // Mark assets without media as loaded immediately
  useEffect(() => {
    if (isLoading) return
    
    console.log(`[AssetsPage] Checking assets for immediate marking. Total: ${filteredAssetsRef.current.length}`)
    setLoadedAssets(prev => {
      const updated = new Set(prev)
      let markedCount = 0
      filteredAssetsRef.current.forEach(asset => {
        const hasMedia = (asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path
        if (!hasMedia && !updated.has(asset.id)) {
          console.log(`[AssetsPage] Marking asset "${asset.id}" as loaded (no media)`)
          updated.add(asset.id)
          markedCount++
        }
      })
      console.log(`[AssetsPage] Marked ${markedCount} assets without media. Total loaded: ${updated.size}`)
      return updated
    })
  }, [filteredAssets.length, isLoading])

  // Check if all content is loaded
  useEffect(() => {
    if (isLoading || isLoadingCollections) {
      setAllContentLoaded(false)
      return
    }

    const currentCollections = filteredCollectionsRef.current
    const currentAssets = filteredAssetsRef.current

    // Check if all collection cards are loaded
    const allCollectionsLoaded = currentCollections.length === 0 || 
      currentCollections.every(collection => loadedCollectionCards.has(collection.id))

    // Check if all asset cards are loaded
    const allAssetsLoaded = currentAssets.length === 0 ||
      currentAssets.every(asset => {
        const hasMedia = (asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path
        return !hasMedia || loadedAssets.has(asset.id)
      })

    console.log(`[AssetsPage] Loading check:`, {
      isLoading,
      isLoadingCollections,
      collectionsCount: currentCollections.length,
      loadedCollectionsCount: loadedCollectionCards.size,
      allCollectionsLoaded,
      assetsCount: currentAssets.length,
      loadedAssetsCount: loadedAssets.size,
      allAssetsLoaded,
      allContentLoaded: allCollectionsLoaded && allAssetsLoaded,
      collectionIds: currentCollections.map(c => c.id),
      loadedCollectionIds: Array.from(loadedCollectionCards)
    })

    if (allCollectionsLoaded && allAssetsLoaded) {
      console.log(`[AssetsPage] All content loaded! Showing cards...`)
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setAllContentLoaded(true)
      }, 100)
    }
  }, [isLoading, isLoadingCollections, filteredCollections.length, filteredAssets.length, loadedCollectionCards.size, loadedAssets.size])

  const loadData = async () => {
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    const supabase = supabaseRef.current

    // Load assets and dimensions in parallel
    // Use getAllActiveAssetsForClient to fetch ALL assets (handles pagination automatically)
    const [
      { data: assetsData, error: assetsError },
      { data: dimensions }
    ] = await Promise.all([
      getAllActiveAssetsForClient(supabase, clientId, {
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
    console.log(`[AssetsPage] Loaded ${allAssets.length} total assets`)
    setAssets(allAssets)
    setFilteredAssets(allAssets)
    setIsLoading(false) // Show assets immediately

    if (!dimensions || dimensions.length === 0) {
      setCollections([])
      setFilteredCollections([])
      setIsLoadingCollections(false)
    } else {
      // Build collections for each dimension - load asynchronously in background (don't await)
      // IMPORTANT: Pass allAssets to ensure collections have access to ALL assets, not just first 1000
      ;(async () => {
        const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
        console.log(`[AssetsPage] Building collections from ${allAssets.length} assets`)
        const allCollections = await loadCollectionsFromDimensions(
          supabase,
          dimensions,
          clientId,
          allAssets
        )

        console.log(`[AssetsPage] Built ${allCollections.length} collections`)
        allCollections.forEach((collection: any) => {
          console.log(`[AssetsPage] Collection "${collection.label}": ${collection.assetCount} assets, ${collection.previewAssets.length} preview assets`)
        })

        // Update collections when ready
        setCollections(allCollections)
        setFilteredCollections(allCollections)
        setIsLoadingCollections(false)
        // Reset loaded collection cards when collections change
        setLoadedCollectionCards(new Set())
      })()
    }

    // Batch fetch signed URLs for all assets that need them (in background)
    const assetsWithMedia = (assetsData || []).filter((asset: Asset) =>
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

  return (
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

      <div className="mb-10">
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
          <CollectionGridSkeleton count={6} />
        ) : filteredCollections.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No collections yet"
            description="Upload assets with collection-generating tags to create collections."
          />
        ) : (
          <>
            {!allContentLoaded && <CollectionGridSkeleton count={6} />}
            <div 
              className={`gap-4 sm:gap-6 ${
                allContentLoaded 
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-row lg:flex-nowrap' 
                  : 'hidden'
              }`}
            >
              {sortedCollections.slice(0, isDesktop ? 4 : sortedCollections.length).map((collection, index) => (
                <div
                  key={collection.id}
                  className="animate-stagger-fade-in w-full lg:w-auto lg:flex-1 lg:flex-shrink-0 lg:min-w-0"
                  style={{
                    animationDelay: `${Math.min(index * 20, 300)}ms`,
                  }}
                >
                  <CollectionCard
                    id={collection.id}
                    label={collection.label}
                    assetCount={collection.assetCount}
                    previewAssets={collection.previewAssets}
                    onLoaded={() => {
                      console.log(`[AssetsPage] Collection "${collection.label}" loaded callback called`)
                      setLoadedCollectionCards(prev => new Set(prev).add(collection.id))
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Hidden cards for loading - render but don't show */}
            {!allContentLoaded && (
              <div style={{ display: 'none' }}>
                {sortedCollections.slice(0, isDesktop ? 4 : sortedCollections.length).map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    id={collection.id}
                    label={collection.label}
                    assetCount={collection.assetCount}
                    previewAssets={collection.previewAssets}
                    onLoaded={() => {
                      console.log(`[AssetsPage] Collection "${collection.label}" loaded callback called`)
                      setLoadedCollectionCards(prev => new Set(prev).add(collection.id))
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Assets Grid */}
      <div>
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

        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600">No assets found</p>
          </div>
        ) : (
          <>
            {!allContentLoaded && <AssetGridSkeleton count={filteredAssets.length || 10} />}
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6"
              style={{
                display: allContentLoaded ? 'grid' : 'none'
              }}
            >
            {filteredAssets.map((asset, index) => {
              const hasMedia = (asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path
              
              return (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}?context=all`}
                className="animate-stagger-fade-in block w-full"
                style={{
                  animationDelay: `${Math.min(index * 15, 200)}ms`,
                }}
              >
                <Card className="group overflow-hidden p-0 transition-shadow rounded-lg w-full !flex-none block">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg w-full" style={{ aspectRatio: '1 / 1' }}>
                    {hasMedia && (
                      <AssetPreview
                        storagePath={asset.storage_path}
                        mimeType={asset.mime_type}
                        alt={asset.title}
                        className={asset.mime_type === "application/pdf" ? "w-full h-full object-contain rounded-lg absolute inset-0" : "w-full h-full object-cover rounded-lg absolute inset-0"}
                        signedUrl={signedUrlsCache[asset.storage_path]} // Pass cached signed URL if available
                        showLoading={false}
                        onAssetLoaded={() => {
                          console.log(`[AssetsPage] Asset "${asset.id}" loaded callback called`)
                          setLoadedAssets(prev => new Set(prev).add(asset.id))
                        }}
                      />
                    )}
                    {!hasMedia && (
                      // For assets without media, mark as loaded immediately
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
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
            {/* Hidden cards for loading - render but don't show */}
            {!allContentLoaded && (
              <div style={{ display: 'none' }}>
                {filteredAssets.map((asset) => {
                  const hasMedia = (asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path
                  return (
                    <div key={asset.id}>
                      {hasMedia && (
                        <AssetPreview
                          storagePath={asset.storage_path}
                          mimeType={asset.mime_type}
                          alt={asset.title}
                          className={asset.mime_type === "application/pdf" ? "w-full h-full object-contain rounded-lg absolute inset-0" : "w-full h-full object-cover rounded-lg absolute inset-0"}
                          signedUrl={signedUrlsCache[asset.storage_path]}
                          showLoading={false}
                          onAssetLoaded={() => {
                            console.log(`[AssetsPage] Asset "${asset.id}" loaded callback called (hidden)`)
                            setLoadedAssets(prev => new Set(prev).add(asset.id))
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onApplyFilters={handleApplyFilters} />

    </div>
  )
}
