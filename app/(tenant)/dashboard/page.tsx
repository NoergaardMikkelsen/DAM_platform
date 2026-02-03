"use client"

import { createClient } from "@/lib/supabase/client"
import { Clock, Download, Package, TrendingUp, Heart, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AssetPreview } from "@/components/asset-preview"
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
import { loadCollectionsFromDimensions } from "@/lib/utils/collections"
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
  const [assets, setAssets] = useState<Asset[]>([])
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

  // Cache helper functions - use shared cache with assets page for better UX
  const { getCachedData, setCachedData } = useLocalStorageCache('assets_cache')
  
  // Track if we're using cached data (for instant display without animations)
  const [isUsingCachedData, setIsUsingCachedData] = useState(false)

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
            // Error setting session
          } else {
            // Remove auth params from URL to clean up
            const cleanUrl = window.location.pathname
            window.history.replaceState({}, '', cleanUrl)
          }
        } catch (err) {
          // Unexpected error
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
      setIsLoading(false)
      return
    }

    // Try to load from cache first - use shared cache with assets page
    const cachedAssets = getCachedData<Asset[]>('assets')
    const cachedDimensions = getCachedData<any[]>('dimensions')
    const cachedCollections = getCachedData<Collection[]>('collections')
    const cachedStats = getCachedData<any>('stats')

    // If we have assets and dimensions from cache (shared with assets page), use them immediately
    // Stats can be loaded separately if not cached
    if (cachedAssets && cachedDimensions) {
      // Use cached data - show immediately
      // Batch state updates to prevent multiple re-renders
      setAssets(cachedAssets)
      
      // Mark that we're using cached data (for instant display)
      setIsUsingCachedData(true)
      
      // Use cached stats if available, otherwise will be loaded in background
      if (cachedStats) {
        setStats(cachedStats)
      }
      
      setIsLoading(false)
      
      // Mark assets as ready for animation immediately if we have cached data
      // This prevents the "staggered" loading effect when coming from cache
      setAssetsReady(true)
      
      // Mark collections as ready too if we have them cached
      if (cachedCollections) {
        setCollectionsReady(true)
      }
      
      if (cachedCollections && cachedCollections.length > 0) {
        // Show cached collections immediately, but rebuild in background to ensure previewAssets are fresh
        setCollections(cachedCollections)
        setIsLoadingCollections(false)
        setCollectionsToShow(Math.min(cachedCollections.length, 4))
        // Mark collections as ready for animation
        setTimeout(() => setCollectionsReady(true), 50)
        
        // Rebuild collections in background to ensure previewAssets are up-to-date
        // This ensures images load correctly even when coming from cache
        if (cachedDimensions && cachedDimensions.length > 0) {
          const supabase = supabaseRef.current
          ;(async () => {
            const allCollections = await loadCollectionsFromDimensions(
              supabase,
              cachedDimensions,
              clientId,
              cachedAssets
            )
            // Only update if collections actually changed (to prevent unnecessary re-renders)
            const currentIds = cachedCollections.map(c => c.id).sort().join(',')
            const newIds = allCollections.map(c => c.id).sort().join(',')
            if (currentIds !== newIds || JSON.stringify(cachedCollections) !== JSON.stringify(allCollections)) {
              setCachedData('collections', allCollections)
              setCollections(allCollections)
              setCollectionsToShow(Math.min(allCollections.length, 4))
            }
          })()
        }
      } else if (cachedDimensions && cachedDimensions.length > 0) {
        // Keep loading state true while building collections
        setIsLoadingCollections(true)
        const supabase = supabaseRef.current
        ;(async () => {
          const allCollections = await loadCollectionsFromDimensions(
            supabase,
            cachedDimensions,
            clientId,
            cachedAssets
          )
          setCachedData('collections', allCollections)
          setCollections(allCollections)
          setIsLoadingCollections(false)
          setCollectionsToShow(Math.min(allCollections.length, 4))
          // Mark collections as ready for animation
          setTimeout(() => setCollectionsReady(true), 50)
        })()
      } else {
        // No dimensions - no collections possible, but keep loading state until refresh completes
        setIsLoadingCollections(true)
      }
      
      // Refresh in background (will update stats if not cached, and refresh assets/collections)
      // Only fetch stats if not cached, skip asset fetch if already cached and recent
      refreshDataInBackground(clientId, true) // Pass flag to indicate we have cached assets
      return
    }

    // No cache - load from database
    setIsUsingCachedData(false) // Reset flag when loading fresh data
    await refreshDataFromDatabase(clientId)
  }

  const refreshDataInBackground = async (clientId: string, hasCachedAssets: boolean = false) => {
    const supabase = supabaseRef.current
    
    // If we have cached assets, only fetch stats-related data, not all assets
    // This prevents unnecessary re-fetching when navigating between pages
    if (hasCachedAssets) {
      const [
        { count: totalAssetsCount },
        { data: recentUploadsData },
        { data: recentEvents },
        { data: dimensions }
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
        getCollectionDimensions(supabase)
      ])

      const downloadsLastWeek = recentEvents?.length || 0
      
      // Get actual storage usage from Storage API
      let storageUsedGB = 0
      let storageLimitGB = 10 // Default fallback
      try {
        const storageResponse = await fetch(`/api/storage-usage/${clientId}`)
        if (storageResponse.ok) {
          const storageData = await storageResponse.json()
          storageUsedGB = storageData.total_gb || 0
          storageLimitGB = storageData.storage_limit_gb || 10
        }
      } catch (error) {
        // Error fetching storage usage
      }
      
      const storagePercentage = storageLimitGB > 0 ? Math.min(Math.round((storageUsedGB / storageLimitGB) * 1000) / 10, 100) : 0

      const statsData = {
        totalAssets: totalAssetsCount || 0,
        recentUploads: recentUploadsData || [],
        downloadsLastWeek,
        storagePercentage,
        storageUsedGB,
        storageLimitGB,
        userName: userData?.full_name || ""
      }
      
      // Update stats cache and state
      setCachedData('stats', statsData)
      setStats(statsData)

      // Always rebuild collections to ensure they're up-to-date with latest assets
      // This ensures previewAssets are correctly loaded even when coming from cache
      const cachedDimensions = getCachedData<any[]>('dimensions')
      const dimensionsChanged = !cachedDimensions || 
        JSON.stringify(cachedDimensions) !== JSON.stringify(dimensions || [])
      
      if (dimensions && dimensions.length > 0) {
        // Update dimensions cache if changed
        if (dimensionsChanged) {
          setCachedData('dimensions', dimensions)
        }
        
        // Always rebuild collections to ensure previewAssets are fresh
        // This is important because assets may have been updated even if dimensions haven't changed
        const cachedAssets = getCachedData<Asset[]>('assets')
        if (cachedAssets) {
          ;(async () => {
            const allCollections = await loadCollectionsFromDimensions(
              supabase,
              dimensions,
              clientId,
              cachedAssets
            )
            setCachedData('collections', allCollections)
            setCollections(allCollections)
            setIsLoadingCollections(false)
            setCollectionsToShow(Math.min(allCollections.length, 4))
            setTimeout(() => setCollectionsReady(true), 50)
          })()
        }
      }
      
      return // Early return - don't fetch all assets
    }
    
    // No cached assets - fetch everything (original behavior)
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
      } else {
        // Fallback to DB calculation if API fails
        storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
        storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
      }
    } catch (error) {
      // Fallback to DB calculation if API fails
      storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
      storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
    }
    
    const storagePercentage = storageLimitGB > 0 ? Math.min(Math.round((storageUsedGB / storageLimitGB) * 1000) / 10, 100) : 0 // Round to 1 decimal place


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
    

    // Only update state if data actually changed to prevent unnecessary re-renders
    setAssets(prevAssets => {
      // Compare by length and first item ID to avoid unnecessary updates
      if (prevAssets.length === allAssets.length && 
          prevAssets.length > 0 && 
          prevAssets[0]?.id === allAssets[0]?.id) {
        // Still update stats even if assets haven't changed (storage might have)
        setCachedData('stats', statsData)
        setStats(statsData)
        return prevAssets // No change, return previous to prevent re-render
      }
      // Data changed - update cache and other states
      setCachedData('assets', allAssets)
      setCachedData('dimensions', dimensions || [])
      setCachedData('stats', statsData)
      setStats(statsData)
      return allAssets
    })

    // Build collections in background if dimensions exist
    // Always rebuild to ensure collections are up-to-date with latest assets and dimensions
    if (dimensions && dimensions.length > 0) {
      ;(async () => {
        const allCollections = await loadCollectionsFromDimensions(
          supabase,
          dimensions,
          clientId,
          allAssets
        )
        setCachedData('collections', allCollections)
        setCollections(allCollections)
        setIsLoadingCollections(false)
        setCollectionsToShow(Math.min(allCollections.length, 4))
        // Mark collections as ready for animation
        setTimeout(() => setCollectionsReady(true), 50)
      })()
    } else {
      // No dimensions - no collections possible
      setCollections([])
      setIsLoadingCollections(false)
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
      } else {
        // Fallback to DB calculation if API fails
        storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
        storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
      }
    } catch (error) {
      // Fallback to DB calculation if API fails
      storageUsedBytes = assetsData?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
      storageUsedGB = Math.round(storageUsedBytes / 1024 / 1024 / 1024 * 100) / 100
    }
    
    const storagePercentage = storageLimitGB > 0 ? Math.min(Math.round((storageUsedGB / storageLimitGB) * 1000) / 10, 100) : 0 // Round to 1 decimal place


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
    

    // Cache the data
    setCachedData('assets', allAssets)
    setCachedData('dimensions', dimensions || [])
    setCachedData('stats', statsData)

    setAssets(allAssets)
    setStats(statsData)
    setIsLoading(false)
    // Mark assets as ready for animation after collections have started (collections show first)
    const collectionsCount = collections.length > 0 ? collections.length : 4 // Default to 4 if not loaded yet
    const collectionsAnimationDuration = Math.min(collectionsCount * 25, 200) + 200 // Reduced buffer for faster loading
    setTimeout(() => setAssetsReady(true), collectionsAnimationDuration)

    if (!dimensions || dimensions.length === 0) {
      setCollections([])
      setIsLoadingCollections(false)
    } else {
      // Build collections for each dimension - load asynchronously in background (don't await)
      ;(async () => {
        const allCollections = await loadCollectionsFromDimensions(
          supabase,
          dimensions,
          clientId,
          allAssets
        )

        // Cache and update collections when ready
        setCachedData('collections', allCollections)
        setCollections(allCollections)
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
        })
    }
  }



  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="p-4 sm:p-8">
          <DashboardHeaderSkeleton />
          <StatsGridSkeleton count={4} />
        </div>

        {/* Collections section skeleton */}
        <div className="mb-10 relative px-4 sm:px-8">
          <SectionHeaderSkeleton showSort={true} />
          <CollectionGridSkeleton count={4} />
        </div>
      </div>
    )
  }

  const sortedCollections = [...collections].sort((a, b) => {
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
                Manage your digital assets, explore collections, and track your storage usage all in one place.
              </p>
            </div>
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
            <div className="h-full" style={{ width: `${stats.storagePercentage}%`, backgroundColor: tenant.primary_color || '#000000' }} />
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
              {isLoadingCollections ? "Loading..." : `${collections.length} Collection${collections.length !== 1 ? "s" : ""}`}
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
        ) : collections.length === 0 ? (
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

    </>
  )
}
