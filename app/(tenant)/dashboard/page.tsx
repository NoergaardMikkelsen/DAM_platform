"use client"

import { createClient } from "@/lib/supabase/client"
import { Clock, Download, Package, TrendingUp, Heart, ArrowRight, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AssetPreview } from "@/components/asset-preview"
import { FilterPanel } from "@/components/filter-panel"
import { CollectionCard } from "@/components/collection-card"
import { InitialLoadingScreen } from "@/components/ui/initial-loading-screen"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { DashboardHeaderSkeleton, StatsGridSkeleton, CollectionGridSkeleton, SectionHeaderSkeleton, AssetGridSkeleton } from "@/components/skeleton-loaders"

interface Collection {
  id: string
  label: string
  slug: string
  assetCount: number
  previewAssets: Array<{
    id: string
    title: string
    storage_path: string
    mime_type: string
    thumbnail_path?: string | null
  }>
}

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
  current_version?: {
    thumbnail_path: string | null
  } | null
}

export default function DashboardPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [collectionSort, setCollectionSort] = useState("newest")
  const [assetSort, setAssetSort] = useState("newest")
  const [isLoading, setIsLoading] = useState(true) // Start with loading true to show skeletons immediately
  const [isLoadingCollections, setIsLoadingCollections] = useState(true) // Separate loading state for collections
  const [maxCollections, setMaxCollections] = useState(4) // Default to 4 collections
  const [stats, setStats] = useState({
    totalAssets: 0,
    recentUploads: [] as Asset[],
    downloadsLastWeek: 0,
    storagePercentage: 0,
    storageUsedGB: 0,
    storageLimitGB: 10,
    userName: ""
  })

  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const { tenant, userData } = useTenant()


  useEffect(() => {
    // Calculate how many collections can fit in one row based on screen width
    const updateMaxCollections = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth
        // Account for padding (p-8 = 32px on each side = 64px total)
        const availableWidth = width - 64
        // CollectionCard width is 280px + gap-6 (24px) = 304px per card
        const cardWidth = 280 + 24
        const maxCols = Math.floor(availableWidth / cardWidth)
        // Ensure at least 1 collection is shown, max 6
        setMaxCollections(Math.min(Math.max(maxCols, 1), 6))
      }
    }

    updateMaxCollections()
    window.addEventListener('resize', updateMaxCollections)
    return () => window.removeEventListener('resize', updateMaxCollections)
  }, [])

  useEffect(() => {
    // Handle cross-subdomain auth transfer (localhost workaround)
    const handleAuthTransfer = async () => {
      const params = new URLSearchParams(window.location.search)
      const isAuthTransfer = params.get('auth_transfer') === 'true'
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (isAuthTransfer && accessToken && refreshToken) {
        try {
          const supabase = supabaseRef.current
          // Set the session using transferred tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error('[AUTH-TRANSFER] Error setting session:', error)
          } else {
            // Remove auth params from URL to clean up
            const cleanUrl = window.location.pathname
            window.history.replaceState({}, '', cleanUrl)
          }
        } catch (err) {
          console.error('[AUTH-TRANSFER] Unexpected error:', err)
        }
      }
    }

    handleAuthTransfer()
  }, [])

  useEffect(() => {
    // Start loading data immediately but with retry logic for session
    loadDashboardData()
  }, [tenant]) // Add tenant as dependency


  const loadDashboardData = async () => {
    // Guard: ensure tenant is available
    if (!tenant || !tenant.id) {
      return
    }

    // isLoading is already true from initial state
    const supabase = supabaseRef.current

    // Server-side layout already verified auth, so we trust the session is valid
    // Don't try to get session client-side as it might not be available immediately when switching subdomains
    // Just proceed with data loading - if session is invalid, server-side auth will catch it

    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    // Use userData from context - already verified server-side
    if (!userData) {
      console.error('[DASHBOARD] No userData in context')
      setIsLoading(false)
      return
    }

    // Load all independent queries in parallel
    const [
      { count: totalAssetsCount },
      { data: recentUploadsData },
      { data: recentEvents },
      { data: assetsData },
      { data: dimensions },
      { data: allAssetsData }
    ] = await Promise.all([
      supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("assets")
        .select("id, title, storage_path, mime_type")
        .eq("client_id", clientId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("asset_events")
        .select("*")
        .eq("event_type", "download")
        .eq("client_id", clientId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("assets")
        .select("file_size")
        .eq("client_id", clientId),
      supabase
        .from("tag_dimensions")
        .select("*")
        .eq("generates_collection", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("assets")
        .select(`
          id,
          title,
          storage_path,
          mime_type,
          current_version:asset_versions!current_version_id (
            thumbnail_path
          )
        `)
        .eq("client_id", clientId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
    ])

    const downloadsLastWeek = recentEvents?.length || 0

    const storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
    const storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
    const storageLimitGB = 10 // Default limit in GB, could be made configurable per tenant later
    const storagePercentage = Math.min(Math.round((storageUsedGB / storageLimitGB) * 100), 100) // Cap at 100%

    // Set assets and stats immediately - don't wait for collections
    setAssets(allAssetsData || [])
    setFilteredAssets(allAssetsData || [])
    setStats({
      totalAssets: totalAssetsCount || 0,
      recentUploads: recentUploadsData || [],
      downloadsLastWeek,
      storagePercentage,
      storageUsedGB,
      storageLimitGB,
      userName: userData?.full_name || ""
    })

    // Show content immediately - assets are ready
    setIsLoading(false)

    if (!dimensions || dimensions.length === 0) {
      setCollections([])
      setFilteredCollections([])
      setIsLoadingCollections(false)
      return
    }

    // Build collections for each dimension - load asynchronously in background (don't await)
    ;(async () => {
      const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
      const allCollections = await loadCollectionsFromDimensions(
        supabase,
        dimensions,
        clientId,
        allAssetsData
      )

      const collectionsData: Collection[] = allCollections

      // Update collections when ready
      setCollections(collectionsData)
      setFilteredCollections(collectionsData)
      setIsLoadingCollections(false)
    })()
  }

  const handleApplyFilters = async (filters: Record<string, string[]>) => {
    const allSelectedTags = Object.values(filters).flat()

    const supabase = supabaseRef.current

    // Filter assets
    let filteredAssetsResult = [...assets]

    if (allSelectedTags.length > 0) {
      // Filter by tags via asset_tags junction table
      const { data: assetTags } = await supabase
        .from("asset_tags")
        .select("asset_id, tag_id")
        .in("tag_id", allSelectedTags)

      // Build map of tag_id -> asset_ids for each dimension
      const tagAssetMap = new Map<string, Set<string>>()
      assetTags?.forEach((at: any) => {
        if (!tagAssetMap.has(at.tag_id)) {
          tagAssetMap.set(at.tag_id, new Set())
        }
        tagAssetMap.get(at.tag_id)!.add(at.asset_id)
      })

      // For each dimension, find assets that match ALL selected tags in that dimension
      // Then intersect results across dimensions (AND logic between dimensions, OR logic within dimension)
      const dimensionAssetSets: Set<string>[] = []

      for (const [dimensionKey, tagIds] of Object.entries(filters)) {
        if (tagIds.length === 0) continue

        // Get assets that have ANY of the selected tags in this dimension (OR logic within dimension)
        const assetSet = new Set<string>()
        tagIds.forEach((tagId) => {
          const assetIds = tagAssetMap.get(tagId)
          if (assetIds) {
            assetIds.forEach((assetId) => assetSet.add(assetId))
          }
        })
        dimensionAssetSets.push(assetSet)
      }

      // Intersect all dimension sets (AND logic between dimensions)
      if (dimensionAssetSets.length > 0) {
        let matchingAssetIds = dimensionAssetSets[0]
        for (let i = 1; i < dimensionAssetSets.length; i++) {
          matchingAssetIds = new Set([...matchingAssetIds].filter((id) => dimensionAssetSets[i].has(id)))
        }
        filteredAssetsResult = filteredAssetsResult.filter((asset) => matchingAssetIds.has(asset.id))
      }
    }

    // Filter collections based on the same filters
    let filteredCollectionsResult = [...collections]

    if (allSelectedTags.length > 0) {
      // Show collections that match any of the selected tags
      filteredCollectionsResult = collections.filter((collection: any) =>
        allSelectedTags.includes(collection.id)
      )
    }

    setFilteredAssets(filteredAssetsResult)
    setFilteredCollections(filteredCollectionsResult)
    setIsFilterOpen(false)
  }


  if (isLoading) {
    return (
      <div className="p-8">
        <DashboardHeaderSkeleton />
        <StatsGridSkeleton count={4} />

        {/* Collections section skeleton */}
        <div className="mb-8">
          <SectionHeaderSkeleton showSort={true} />
          <CollectionGridSkeleton count={6} />
        </div>
      </div>
    )
  }

  const sortedCollections = [...filteredCollections].sort((a, b) => {
    if (collectionSort === "newest") {
      // Sort by asset count descending (most assets first)
      return b.assetCount - a.assetCount
    } else if (collectionSort === "oldest") {
      // Sort by asset count ascending (least assets first)
      return a.assetCount - b.assetCount
    } else if (collectionSort === "name") {
      // Sort alphabetically by label
      return a.label.localeCompare(b.label)
    }
    return b.assetCount - a.assetCount
  })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome {stats.userName}</h1>
          <p className="mt-2 text-gray-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim
          </p>
        </div>
        <Button variant="secondary" onClick={() => setIsFilterOpen(true)}>
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-stagger-fade-in"
           style={{ animationDelay: '50ms' }}>
        <div className="animate-stagger-fade-in bg-white rounded-[20px] p-5 flex flex-col" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Storage usage</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{stats.storagePercentage}%</div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full" style={{ width: `${stats.storagePercentage}%`, backgroundColor: tenant.primary_color || '#dc3545' }} />
          </div>
        </div>

        <div className="animate-stagger-fade-in bg-white rounded-[20px] p-5 flex flex-col" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Total assets</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{stats.totalAssets}</div>
          </div>
        </div>

        <div className="animate-stagger-fade-in bg-white rounded-[20px] p-5 flex flex-col" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Recent uploads</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{stats.recentUploads.length}</div>
          </div>
        </div>

        <div className="animate-stagger-fade-in bg-white rounded-[20px] p-5 flex flex-col" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Assets downloaded</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{stats.downloadsLastWeek}</div>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {isLoadingCollections ? "Loading..." : `${collections.length} Collection${collections.length !== 1 ? "s" : ""}`}
            </h2>
            <button
              onClick={() => {
                // Use full URL with tenant subdomain to ensure proper routing
                const currentUrl = window.location.href
                const url = new URL(currentUrl)
                url.pathname = '/assets/collections'
                router.push(url.pathname)
              }}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              See all collections →
            </button>
          </div>
          <Select value={collectionSort} onValueChange={setCollectionSort}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort by Newest</SelectItem>
              <SelectItem value="oldest">Sort by Oldest</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoadingCollections ? (
          <CollectionGridSkeleton count={6} />
        ) : filteredCollections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No collections yet. Collections will be automatically created when you tag assets with collection-generating tags.</p>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2 sm:flex-nowrap">
            {sortedCollections.slice(0, maxCollections).map((collection, index) => (
              <div
                key={collection.id}
                className="animate-stagger-fade-in flex-shrink-0"
                style={{
                  animationDelay: `${Math.min(index * 20, 300)}ms`, // Reduced delay from 40ms to 20ms, max from 600ms to 300ms
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

      {/* Assets Preview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{stats.totalAssets} Assets</h2>
            <button
              onClick={() => router.push('/assets')}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              See all assets →
            </button>
          </div>
          <Select value={assetSort} onValueChange={setAssetSort}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort by Newest</SelectItem>
              <SelectItem value="oldest">Sort by Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stats.recentUploads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No assets uploaded yet.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {stats.recentUploads.map((asset, index) => (
              <Link 
                key={asset.id} 
                href={`/assets/${asset.id}?context=all`} 
                className="block break-inside-avoid animate-stagger-fade-in mb-6"
                style={{
                  animationDelay: `${Math.min(index * 15, 200)}ms`, // Even faster animation for assets - 15ms delay, max 200ms
                }}
              >
                <Card className="group overflow-hidden p-0 transition-shadow mb-6">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 aspect-square">
                    {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path && (
                      <AssetPreview
                        storagePath={asset.storage_path}
                        mimeType={asset.mime_type}
                        alt={asset.title}
                        className={asset.mime_type === "application/pdf" ? "w-full h-full object-contain" : "w-full h-full object-cover"}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 h-[42px] w-[42px] rounded-full bg-white/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={handleApplyFilters}
      />
    </div>
  )
}
