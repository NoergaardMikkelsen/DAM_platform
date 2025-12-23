"use client"

import { createClient } from "@/lib/supabase/client"
import { Clock, Download, Package, TrendingUp, Heart, ArrowRight, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AssetPreview } from "@/components/asset-preview"
import { FilterPanel } from "@/components/filter-panel"
import { CollectionCard } from "@/components/collection-card"
import { InitialLoadingScreen } from "@/components/ui/initial-loading-screen"
import { useState, useEffect, useRef } from "react"
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
  category_tag_id: string | null
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
  const [isLoading, setIsLoading] = useState(false)
  const [maxCollections, setMaxCollections] = useState(3)
  const [shouldAnimate, setShouldAnimate] = useState(false) // Control when stagger animation should start
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
  const { tenant } = useTenant()

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
    loadDashboardData()
  }, [tenant]) // Add tenant as dependency

  useEffect(() => {
    const updateMaxCollections = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth
        // For horizontal scrolling layout, allow reasonable number but not unlimited
        const availableWidth = width - 64 // Account for padding
        const cardWidth = 200 + 32 // 200px min card + 32px gap
        const maxCols = Math.floor(availableWidth / cardWidth)


        // For horizontal scroll: allow up to 12 max, min 2
        const finalMax = Math.min(Math.max(maxCols, 2), 12)
        setMaxCollections(finalMax)
      }
    }

    updateMaxCollections()
    window.addEventListener('resize', updateMaxCollections)
    return () => window.removeEventListener('resize', updateMaxCollections)
  }, [])

  const loadDashboardData = async () => {
    // Guard: ensure tenant is available
    if (!tenant || !tenant.id) {
      return
    }

    setIsLoading(true)
    const supabase = supabaseRef.current

    // Server-side layout already verified auth, so we get user for data queries
    // Use getSession instead of getUser since cookies might be httpOnly
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
      // Session not found client-side, but server verified - likely httpOnly cookie issue
      // Reload page to let server handle it
      window.location.reload()
      return
    }

    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    // Get stats
    const { count: totalAssetsCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)

    const { data: recentUploadsData } = await supabase
      .from("assets")
      .select("id, title, storage_path, mime_type, category_tag_id")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10)

    const { data: recentEvents } = await supabase
      .from("asset_events")
      .select("*")
      .eq("event_type", "download")
      .eq("client_id", clientId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const downloadsLastWeek = recentEvents?.length || 0

    // Get storage usage - same method as system-admin dashboard
    const { data: assetsData } = await supabase.from("assets").select("file_size").eq("client_id", clientId)

    const storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
    const storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
    const storageLimitGB = 10 // Default limit in GB, could be made configurable per tenant later
    const storagePercentage = Math.min(Math.round((storageUsedGB / storageLimitGB) * 100), 100) // Cap at 100%

    const { data: userData } = await supabase.from("users").select("full_name").eq("id", user.id).single()

    const { data: categoryTags } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("tag_type", "category")
      .or(`client_id.is.null,client_id.eq.${clientId}`)
      .order("sort_order", { ascending: true })

    // Get all assets to build collection previews
    const { data: allAssetsData } = await supabase
      .from("assets")
      .select(`
        id,
        title,
        storage_path,
        mime_type,
        category_tag_id,
        current_version:asset_versions!current_version_id (
          thumbnail_path
        )
      `)
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    // Build collections from category tags
    const collectionsData: Collection[] = (categoryTags || [])
      .map((tag: any) => {
        const tagAssets = (allAssetsData || []).filter((a: any) => a.category_tag_id === tag.id)
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
      .filter((c: any) => c.assetCount > 0)

    setCollections(collectionsData)
    setFilteredCollections(collectionsData)
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
    setIsLoading(false)
    // Start stagger animation after a short delay to ensure content is rendered
    setTimeout(() => {
      setShouldAnimate(true)
    }, 100)
  }

  const handleApplyFilters = async (filters: {
    categoryTags: string[]
    descriptionTags: string[]
    usageTags: string[]
    visualStyleTags: string[]
  }) => {
    const allSelectedTags = [
      ...filters.categoryTags,
      ...filters.descriptionTags,
      ...filters.usageTags,
      ...filters.visualStyleTags,
    ]

    const supabase = supabaseRef.current

    // Filter assets
    let filteredAssetsResult = [...assets]

    if (allSelectedTags.length > 0) {
      // Filter by category tags directly on assets
      if (filters.categoryTags.length > 0) {
        filteredAssetsResult = filteredAssetsResult.filter(
          (asset) => asset.category_tag_id && filters.categoryTags.includes(asset.category_tag_id),
        )
      }

      // Filter by other tags via asset_tags junction
      const otherTags = [...filters.descriptionTags, ...filters.usageTags, ...filters.visualStyleTags]

      if (otherTags.length > 0) {
        const { data: assetTags } = await supabase.from("asset_tags").select("asset_id").in("tag_id", otherTags)

        const assetIds = [...new Set(assetTags?.map((at: any) => at.asset_id) || [])]
        filteredAssetsResult = filteredAssetsResult.filter((asset) => assetIds.includes(asset.id))
      }
    }

    // Filter collections based on the same filters
    let filteredCollectionsResult = [...collections]

    if (allSelectedTags.length > 0) {
      // For collections, we filter by category tags only (simplified for dashboard)
      if (filters.categoryTags.length > 0) {
        filteredCollectionsResult = collections.filter((collection: any) =>
          filters.categoryTags.includes(collection.id)
        )
      } else {
        // For other tags, show collections that have assets (simplified)
        filteredCollectionsResult = collections.filter((collection: any) => collection.assetCount > 0)
      }
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

  const sortedCollections = [...filteredCollections].sort((a, b) => b.assetCount - a.assetCount)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome {stats.userName}</h1>
          <p className="mt-2 text-gray-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsFilterOpen(true)}>
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Storage usage</CardTitle>
            <Package className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.storageUsedGB.toFixed(2).replace('.', ',')} GB</div>
            <p className="text-xs text-gray-500 mt-1">of {stats.storageLimitGB} GB limit</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full" style={{ width: `${stats.storagePercentage}%`, backgroundColor: tenant.primary_color || '#dc3545' }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total assets</CardTitle>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.totalAssets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Recent uploads</CardTitle>
            <Clock className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.recentUploads.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Assets downloaded</CardTitle>
            <Download className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.downloadsLastWeek}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {collections.length > maxCollections ? `${maxCollections}+ of ${collections.length}` : `${collections.length}`} Collections
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
          <span className="text-sm text-gray-500">Sort collection by Newest</span>
        </div>

        {!shouldAnimate ? (
          // Show skeleton while waiting for animation to start - match the actual number that will be shown
          // Use collections.length (primary state) or filteredCollections.length, whichever is available
          <CollectionGridSkeleton count={4} />
        ) : filteredCollections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No collections yet. Upload assets with category tags to create collections.</p>
            <Button
              onClick={() => router.push('/assets/upload')}
              className="mt-4 bg-transparent hover:bg-transparent border-0"
              style={{ backgroundColor: tenant.primary_color, color: 'white' }}
            >
              Upload your first asset
            </Button>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2">
            {sortedCollections.slice(0, maxCollections).map((collection, index) => (
              <div
                key={collection.id}
                className="animate-stagger-fade-in"
                style={{
                  animationDelay: `${Math.min(index * 40, 600)}ms`,
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
          <span className="text-sm text-gray-500">Sort assets by Newest</span>
        </div>

        {!shouldAnimate ? (
          // Show skeleton while waiting for animation to start
          <AssetGridSkeleton count={Math.min(10, stats.recentUploads.length || 10)} />
        ) : stats.recentUploads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No assets uploaded yet.</p>
            <Button
              onClick={() => router.push('/assets/upload')}
              className="mt-4 bg-transparent hover:bg-transparent border-0"
              style={{ backgroundColor: tenant.primary_color, color: 'white' }}
            >
              Upload your first asset
            </Button>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {stats.recentUploads.map((asset, index) => (
              <Link 
                key={asset.id} 
                href={`/assets/${asset.id}?context=all`} 
                className="block break-inside-avoid animate-stagger-fade-in mb-6"
                style={{
                  animationDelay: `${Math.min(index * 40, 600)}ms`,
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
