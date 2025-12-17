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
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardHeaderSkeleton, StatsGridSkeleton, CollectionGridSkeleton } from "@/components/skeleton-loaders"

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
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [maxCollections, setMaxCollections] = useState(3)
  const [loadedAssets, setLoadedAssets] = useState(0)
  const [totalAssets, setTotalAssets] = useState(0)
  const [stats, setStats] = useState({
    totalAssets: 0,
    recentUploads: [] as Asset[],
    downloadsLastWeek: 0,
    storagePercentage: 0,
    userName: ""
  })

  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const handleAssetLoaded = useCallback(() => {
    setLoadedAssets(prev => {
      const newCount = prev + 1
      // When all assets are loaded, hide the skeleton
      if (newCount >= totalAssets && totalAssets > 0) {
        setIsLoading(false)
      }
      return newCount
    })
  }, [totalAssets])

  useEffect(() => {
    // Show initial loading screen only on first login in this session
    const hasSeenInitialLoading = sessionStorage.getItem('hasSeenInitialLoading')

    if (!hasSeenInitialLoading) {
      setIsInitialLoading(true)
      sessionStorage.setItem('hasSeenInitialLoading', 'true')
    } else {
      // If already seen, just load data directly
      loadDashboardData()
    }
  }, [])

  useEffect(() => {
    const updateMaxCollections = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth
        // Calculate how many 200px+ cards can fit
        const availableWidth = width - 64 // Account for padding
        const cardWidth = 200 + 32 // 200px min card + 32px gap
        const maxCols = Math.floor(availableWidth / cardWidth)

        // Cap at 4 max, minimum 2
        setMaxCollections(Math.min(Math.max(maxCols, 2), 4))
      }
    }

    updateMaxCollections()
    window.addEventListener('resize', updateMaxCollections)
    return () => window.removeEventListener('resize', updateMaxCollections)
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Check if user is superadmin
    const { data: userRole } = await supabase
      .from("client_users")
      .select(`roles(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    const isSuperAdmin = userRole?.roles?.key === "superadmin"

    let clientIds: string[] = []

    if (isSuperAdmin) {
      // Superadmin can see all clients
      const { data: allClients } = await supabase
        .from("clients")
        .select("id")
        .eq("status", "active")
      clientIds = allClients?.map((c: any) => c.id) || []
    } else {
      // Regular users see only their clients
      const { data: clientUsers } = await supabase
        .from("client_users")
        .select(`client_id`)
        .eq("user_id", user.id)
        .eq("status", "active")
      clientIds = clientUsers?.map((cu: any) => cu.client_id) || []
    }

    // Get stats
    const { count: totalAssetsCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .in("client_id", clientIds)

    const { data: recentUploadsData } = await supabase
      .from("assets")
      .select("id, title, storage_path, mime_type, category_tag_id")
      .in("client_id", clientIds)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10)

    const { data: recentEvents } = await supabase
      .from("asset_events")
      .select("*")
      .eq("event_type", "download")
      .in("client_id", clientIds)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const downloadsLastWeek = recentEvents?.length || 0

    // Get storage usage
    const { data: assetsData } = await supabase.from("assets").select(`
      file_size,
      id,
      title,
      storage_path,
      mime_type,
      category_tag_id,
      current_version:asset_versions!current_version_id (
        thumbnail_path
      )
    `).in("client_id", clientIds)

    const storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
    const storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024))
    const storageLimitMB = 10000
    const storagePercentage = Math.round((storageUsedMB / storageLimitMB) * 100)

    const { data: userData } = await supabase.from("users").select("full_name").eq("id", user.id).single()

    const { data: categoryTags } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("tag_type", "category")
      .or(`is_system.eq.true,client_id.in.(${clientIds.join(",")})`)
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
      .in("client_id", clientIds)
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

    // Count total assets that need to be loaded (only recent uploads shown on dashboard)
    const totalAssetsToLoad = (recentUploadsData || []).filter(asset =>
      asset.mime_type?.startsWith("image/") ||
      asset.mime_type?.startsWith("video/") ||
      asset.mime_type === "application/pdf"
    ).length

    setTotalAssets(totalAssetsToLoad)
    setLoadedAssets(0) // Reset counter

    setStats({
      totalAssets: totalAssetsCount || 0,
      recentUploads: recentUploadsData || [],
      downloadsLastWeek,
      storagePercentage,
      userName: userData?.full_name || ""
    })

    // If no assets need to be loaded, hide skeleton immediately
    if (totalAssetsToLoad === 0) {
      setIsLoading(false)
    }
    // Otherwise, wait for all assets to load
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

  if (isInitialLoading) {
    return <InitialLoadingScreen onComplete={() => {
      setIsInitialLoading(false)
      loadDashboardData()
    }} />
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <DashboardHeaderSkeleton />
        <StatsGridSkeleton count={4} />

        {/* Collections section skeleton */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
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
          <h1 className="text-3xl font-bold text-gray-900">Velkommen {stats.userName}</h1>
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
            <div className="text-2xl font-bold text-gray-900">{stats.storagePercentage}%</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-[#dc3545]" style={{ width: `${stats.storagePercentage}%` }} />
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
            <h2 className="text-xl font-semibold text-gray-900">{filteredCollections.length} Collections</h2>
            <Link href="/assets" className="text-sm text-gray-500 hover:text-gray-700">
              See all collections →
            </Link>
          </div>
          <span className="text-sm text-gray-500">Sort collection by Newest</span>
        </div>

        {filteredCollections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No collections yet. Upload assets with category tags to create collections.</p>
            <Link href="/assets/upload">
              <Button className="mt-4 bg-[#dc3545] hover:bg-[#c82333]">Upload your first asset</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {sortedCollections.slice(0, maxCollections).map((collection) => (
              <CollectionCard
                key={collection.id}
                id={collection.id}
                label={collection.label}
                assetCount={collection.assetCount}
                previewAssets={collection.previewAssets}
              />
            ))}
          </div>
        )}
      </div>

      {/* Assets Preview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{stats.totalAssets} Assets</h2>
            <Link href="/assets" className="text-sm text-gray-500 hover:text-gray-700">
              See all assets →
            </Link>
          </div>
          <span className="text-sm text-gray-500">Sort assets by Newest</span>
        </div>

        {stats.recentUploads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No assets uploaded yet.</p>
            <Link href="/assets/upload">
              <Button className="mt-4 bg-[#dc3545] hover:bg-[#c82333]">Upload your first asset</Button>
            </Link>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-4 gap-6">
            {stats.recentUploads.map((asset) => (
              <Link key={asset.id} href={`/assets/${asset.id}?context=all`} className="block mb-6 break-inside-avoid">
                <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg mb-6">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200">
                    {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path && (
                      <AssetPreview
                        storagePath={asset.storage_path}
                        mimeType={asset.mime_type}
                        alt={asset.title}
                        className={asset.mime_type === "application/pdf" ? "w-full h-auto" : "w-full h-full object-cover"}
                        showLoading={false}
                        onAssetLoaded={handleAssetLoaded}
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
