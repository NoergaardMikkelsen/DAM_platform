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
import { EmptyState } from "@/components/empty-state"
import { FolderOpen } from "lucide-react"
import { InitialLoadingScreen } from "@/components/ui/initial-loading-screen"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { DashboardHeaderSkeleton, StatsGridSkeleton, CollectionGridSkeleton, SectionHeaderSkeleton, AssetGridSkeleton } from "@/components/skeleton-loaders"
import { sortItems } from "@/lib/utils/sorting"
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
  }
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
  const [collectionsToShow, setCollectionsToShow] = useState(4) // Max 4 collections
  const [signedUrlsCache, setSignedUrlsCache] = useState<Record<string, string>>({})
  const [collectionsReady, setCollectionsReady] = useState(false) // Track when collections are ready to animate
  const [assetsReady, setAssetsReady] = useState(false) // Track when assets are ready to animate
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


  // Cache helper functions
  const { getCachedData, setCachedData } = useLocalStorageCache('dashboard_cache')

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
    // Start loading data immediately
    loadDashboardData()
  }, [])


  const loadDashboardData = async () => {
    // Guard: ensure tenant is available
    if (!tenant || !tenant.id) {
      return
    }

    const clientId = tenant.id

    // Use userData from context - already verified server-side
    if (!userData) {
      console.error('[DASHBOARD] No userData in context')
      setIsLoading(false)
      return
    }

    // Try to load from cache first
    const cachedAssets = getCachedData<Asset[]>('assets')
    const cachedDimensions = getCachedData<any[]>('dimensions')
    const cachedCollections = getCachedData<Collection[]>('collections')
    const cachedStats = getCachedData<any>('stats')

    if (cachedAssets && cachedDimensions && cachedStats) {
      // Use cached data - show immediately
      setAssets(cachedAssets)
      setFilteredAssets(cachedAssets)
      setStats(cachedStats)
      setIsLoading(false)
      // Mark assets as ready for animation after collections have started
      const collectionsCount = cachedCollections?.length || 4
      const collectionsAnimationDuration = Math.min(collectionsCount * 25, 200) + 200 // Reduced buffer for faster loading
      setTimeout(() => setAssetsReady(true), collectionsAnimationDuration)
      
      if (cachedCollections) {
        setCollections(cachedCollections)
        setFilteredCollections(cachedCollections)
        setIsLoadingCollections(false)
        setCollectionsToShow(Math.min(cachedCollections.length, 4))
        // Mark collections as ready for animation
        setTimeout(() => setCollectionsReady(true), 50)
      } else if (cachedDimensions && cachedDimensions.length > 0) {
        // Keep loading state true while building collections
        setIsLoadingCollections(true)
        const supabase = supabaseRef.current
        ;(async () => {
          const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
          const allCollections = await loadCollectionsFromDimensions(
            supabase,
            cachedDimensions,
            clientId,
            cachedAssets
          )
          setCachedData('collections', allCollections)
          setCollections(allCollections)
          setFilteredCollections(allCollections)
          setIsLoadingCollections(false)
          setCollectionsToShow(Math.min(allCollections.length, 4))
          // Mark collections as ready for animation
          setTimeout(() => setCollectionsReady(true), 50)
        })()
      } else {
        // No dimensions - no collections possible, but keep loading state until refresh completes
        setIsLoadingCollections(true)
      }
      
      // Refresh in background
      refreshDataInBackground(clientId)
      return
    }

    // No cache - load from database
    await refreshDataFromDatabase(clientId)
  }

  const refreshDataInBackground = async (clientId: string) => {
    const supabase = supabaseRef.current
    
    const [
      { count: totalAssetsCount },
      { data: recentUploadsData },
      { data: recentEvents },
      { data: assetsData },
      { data: dimensions },
      allAssetsResult
    ] = await Promise.all([
      supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("assets")
        .select("id, title, storage_path, mime_type, created_at")
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
      getCollectionDimensions(supabase),
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
      })
    ])

    const downloadsLastWeek = recentEvents?.length || 0
    
    // Get actual storage usage from Storage API
    let storageUsedBytes = 0
    let storageUsedGB = 0
    let storageLimitGB = 10 // Default fallback
    try {
      const storageResponse = await fetch(`/api/storage-usage/${clientId}`)
      if (storageResponse.ok) {
        const storageData = await storageResponse.json()
        storageUsedBytes = storageData.total_bytes || 0
        storageUsedGB = storageData.total_gb || 0
        storageLimitGB = storageData.storage_limit_gb || 10
        console.log('[DASHBOARD] Storage data:', { 
          storageUsedBytes, 
          storageUsedGB, 
          storageLimitGB, 
          storageLimitMB: storageData.storage_limit_mb,
          percentage: storageLimitGB > 0 ? Math.round((storageUsedGB / storageLimitGB) * 100) : 0,
          fullData: storageData 
        })
      } else {
        console.error('[DASHBOARD] Storage API failed:', storageResponse.status, await storageResponse.text())
        // Fallback to DB calculation if API fails
        storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
        storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
      }
    } catch (error) {
      console.error('[DASHBOARD] Error fetching storage usage:', error)
      // Fallback to DB calculation if API fails
      storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
      storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
    }
    
    const storagePercentage = storageLimitGB > 0 ? Math.min(Math.round((storageUsedGB / storageLimitGB) * 1000) / 10, 100) : 0 // Round to 1 decimal place

    console.log('[DASHBOARD] Calculated storage percentage:', {
      storageUsedGB,
      storageLimitGB,
      storagePercentage,
      calculation: `${storageUsedGB} / ${storageLimitGB} * 100 = ${storagePercentage}%`
    })

    const allAssets = allAssetsResult?.data || []
    const statsData = {
      totalAssets: totalAssetsCount || 0,
      recentUploads: recentUploadsData || [],
      downloadsLastWeek,
      storagePercentage,
      storageUsedGB,
      storageLimitGB,
      userName: userData?.full_name || ""
    }
    
    console.log('[DASHBOARD] Setting statsData:', statsData)

    // Only update state if data actually changed to prevent unnecessary re-renders
    setAssets(prevAssets => {
      // Compare by length and first item ID to avoid unnecessary updates
      if (prevAssets.length === allAssets.length && 
          prevAssets.length > 0 && 
          prevAssets[0]?.id === allAssets[0]?.id) {
        // Still update stats even if assets haven't changed (storage might have)
        console.log('[DASHBOARD] Assets unchanged, but updating stats:', statsData)
        setCachedData('stats', statsData)
        setStats(statsData)
        return prevAssets // No change, return previous to prevent re-render
      }
      // Data changed - update cache and other states
      console.log('[DASHBOARD] Assets changed, updating all data:', statsData)
      setCachedData('assets', allAssets)
      setCachedData('dimensions', dimensions || [])
      setCachedData('stats', statsData)
      setFilteredAssets(allAssets)
      setStats(statsData)
      return allAssets
    })

    // Build collections in background only if dimensions exist and collections aren't already loaded
    setCollections(prevCollections => {
      if (prevCollections.length > 0) {
        return prevCollections // Already loaded, don't rebuild
      }
      
      // Build collections asynchronously
      if (dimensions && dimensions.length > 0) {
        ;(async () => {
          const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
          const allCollections = await loadCollectionsFromDimensions(
            supabase,
            dimensions,
            clientId,
            allAssets
          )
          setCachedData('collections', allCollections)
          setCollections(allCollections)
          setFilteredCollections(allCollections)
          setIsLoadingCollections(false)
          setCollectionsToShow(Math.min(allCollections.length, 4))
          // Mark collections as ready for animation
          setTimeout(() => setCollectionsReady(true), 50)
        })()
      }
      
      return prevCollections
    })

    // Batch fetch signed URLs for recent uploads (in background)
    const assetsWithMedia = (recentUploadsData || []).filter((asset: Asset) =>
      asset.mime_type?.startsWith("image/") ||
      asset.mime_type?.startsWith("video/") ||
      asset.mime_type === "application/pdf"
    )

    if (assetsWithMedia.length > 0) {
      const assetIds = assetsWithMedia.map((a: Asset) => a.id).filter(Boolean)
      
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
          console.error('[DASHBOARD] Error fetching signed URLs:', error)
        })
    }
  }

  const refreshDataFromDatabase = async (clientId: string) => {
    const supabase = supabaseRef.current

    const [
      { count: totalAssetsCount },
      { data: recentUploadsData },
      { data: recentEvents },
      { data: assetsData },
      { data: dimensions },
      allAssetsResult
    ] = await Promise.all([
      supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("assets")
        .select("id, title, storage_path, mime_type, created_at")
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
      getCollectionDimensions(supabase),
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
      })
    ])

    const downloadsLastWeek = recentEvents?.length || 0
    
    // Get actual storage usage from Storage API
    let storageUsedBytes = 0
    let storageUsedGB = 0
    let storageLimitGB = 10 // Default fallback
    try {
      const storageResponse = await fetch(`/api/storage-usage/${clientId}`)
      if (storageResponse.ok) {
        const storageData = await storageResponse.json()
        storageUsedBytes = storageData.total_bytes || 0
        storageUsedGB = storageData.total_gb || 0
        storageLimitGB = storageData.storage_limit_gb || 10
        console.log('[DASHBOARD] Storage data:', { 
          storageUsedBytes, 
          storageUsedGB, 
          storageLimitGB, 
          storageLimitMB: storageData.storage_limit_mb,
          percentage: storageLimitGB > 0 ? Math.round((storageUsedGB / storageLimitGB) * 100) : 0,
          fullData: storageData 
        })
      } else {
        console.error('[DASHBOARD] Storage API failed:', storageResponse.status, await storageResponse.text())
        // Fallback to DB calculation if API fails
        storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
        storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
      }
    } catch (error) {
      console.error('[DASHBOARD] Error fetching storage usage:', error)
      // Fallback to DB calculation if API fails
      storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
      storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
    }
    
    const storagePercentage = storageLimitGB > 0 ? Math.min(Math.round((storageUsedGB / storageLimitGB) * 1000) / 10, 100) : 0 // Round to 1 decimal place

    console.log('[DASHBOARD] Calculated storage percentage:', {
      storageUsedGB,
      storageLimitGB,
      storagePercentage,
      calculation: `${storageUsedGB} / ${storageLimitGB} * 100 = ${storagePercentage}%`
    })

    const allAssets = allAssetsResult?.data || []
    const statsData = {
      totalAssets: totalAssetsCount || 0,
      recentUploads: recentUploadsData || [],
      downloadsLastWeek,
      storagePercentage,
      storageUsedGB,
      storageLimitGB,
      userName: userData?.full_name || ""
    }
    
    console.log('[DASHBOARD] Setting statsData:', statsData)

    // Cache the data
    setCachedData('assets', allAssets)
    setCachedData('dimensions', dimensions || [])
    setCachedData('stats', statsData)

    setAssets(allAssets)
    setFilteredAssets(allAssets)
    setStats(statsData)
    setIsLoading(false)
    // Mark assets as ready for animation after collections have started (collections show first)
    const collectionsCount = collections.length > 0 ? collections.length : 4 // Default to 4 if not loaded yet
    const collectionsAnimationDuration = Math.min(collectionsCount * 25, 200) + 200 // Reduced buffer for faster loading
    setTimeout(() => setAssetsReady(true), collectionsAnimationDuration)

    if (!dimensions || dimensions.length === 0) {
      setCollections([])
      setFilteredCollections([])
      setIsLoadingCollections(false)
    } else {
      // Build collections for each dimension - load asynchronously in background (don't await)
      ;(async () => {
        const { loadCollectionsFromDimensions } = await import("@/lib/utils/collections")
        const allCollections = await loadCollectionsFromDimensions(
          supabase,
          dimensions,
          clientId,
          allAssets
        )

        // Cache and update collections when ready
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
    
    // Batch fetch signed URLs for recent uploads (in background)
    const assetsWithMedia = (recentUploadsData || []).filter((asset: Asset) =>
      asset.mime_type?.startsWith("image/") ||
      asset.mime_type?.startsWith("video/") ||
      asset.mime_type === "application/pdf"
    )

    if (assetsWithMedia.length > 0) {
      const assetIds = assetsWithMedia.map((a: Asset) => a.id).filter(Boolean)
      
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
          console.error('[DASHBOARD] Error fetching signed URLs:', error)
        })
    }
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
  const sortedAssets = sortItems(stats.recentUploads, assetSort as any)

  return (
    <>
      <div className="mx-auto w-full max-w-7xl">
        <div className="p-4 sm:p-8">
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
            <div className="text-lg font-bold text-gray-900">{stats.storagePercentage.toFixed(1).replace('.', ',')}%</div>
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
        </div>

      {/* Collections Section */}
      <div className="mb-10 relative px-4 sm:px-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {isLoadingCollections ? "Loading..." : `${filteredCollections.length} Collection${filteredCollections.length !== 1 ? "s" : ""}`}
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
                className={collectionsReady ? "animate-stagger-fade-in w-full" : "opacity-0 w-full"}
                style={collectionsReady ? {
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

      {/* Assets Preview */}
      <div className="px-4 sm:px-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {stats.recentUploads.length} Recent Asset{stats.recentUploads.length !== 1 ? "s" : ""}
            </h2>
            <button
              onClick={() => router.push('/assets')}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer hidden sm:inline"
            >
              See all assets →
            </button>
          </div>
          <Select value={assetSort} onValueChange={setAssetSort}>
            <SelectTrigger className="w-full sm:w-[200px]" suppressHydrationWarning>
              <SelectValue placeholder="Sort assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort assets by Newest</SelectItem>
              <SelectItem value="oldest">Sort assets by Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stats.recentUploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600">No assets found</p>
          </div>
        ) : (
          <div className="gap-4 sm:gap-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sortedAssets.map((asset, index) => {
              const hasMedia = (asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path
              
              // Smooth staggered loading - start after collections with minimal stagger
              const collectionsCount = collectionsToShow
              const collectionsAnimationDuration = Math.min(collectionsCount * 25, 200) + 200 // Reduced buffer for faster loading
              const assetDelay = collectionsAnimationDuration + (index * 15) // Reduced stagger delay for smoother flow
              
              return (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}?context=all`}
                  className={assetsReady ? "animate-stagger-fade-in w-full" : "opacity-0 w-full"}
                  style={assetsReady ? {
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
                          signedUrl={signedUrlsCache[asset.storage_path]}
                          showLoading={false}
                        />
                      )}
                      {!hasMedia && (
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

    <FilterPanel
      isOpen={isFilterOpen}
      onClose={() => setIsFilterOpen(false)}
      onApplyFilters={handleApplyFilters}
    />
    </>
  )
}
