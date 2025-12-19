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
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
  created_at: string
  file_size: number
  category_tag_id: string | null
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
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [collectionSort, setCollectionSort] = useState("newest")
  const [isLoading, setIsLoading] = useState(true)
  const [maxCollections, setMaxCollections] = useState(3)
  const [loadedAssets, setLoadedAssets] = useState(0)
  const [totalAssets, setTotalAssets] = useState(0)
  const [signedUrlsCache, setSignedUrlsCache] = useState<Record<string, string>>({})
  const [signedUrlsReady, setSignedUrlsReady] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false) // Control when stagger animation should start
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const handleAssetLoaded = useCallback(() => {
    setLoadedAssets(prev => {
      const newCount = prev + 1
      
      // Smart threshold: Show content when we have minimum assets loaded OR all assets loaded
      // Minimum is either 30% of total or 12 assets (whichever is smaller)
      const minAssetsToShow = totalAssets > 0 
        ? Math.min(12, Math.max(6, Math.ceil(totalAssets * 0.3)))
        : 0
      
      // Show content when:
      // 1. Signed URLs are ready AND
      // 2. We have minimum assets loaded OR all assets are loaded
      if (signedUrlsReady && totalAssets > 0) {
        if (newCount >= minAssetsToShow || newCount >= totalAssets) {
          setIsLoading(false)
          // Start stagger animation once we have enough assets loaded
          if (!shouldAnimate) {
            setShouldAnimate(true)
          }
        }
      }
      
      return newCount
    })
  }, [totalAssets, signedUrlsReady])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])

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

  const loadData = async () => {
    const debugLog: string[] = []
    debugLog.push(`[ASSETS-PAGE] Starting loadData`)
    
    const supabase = supabaseRef.current
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError) {
      debugLog.push(`[ASSETS-PAGE] Get user error: ${userError.message}`)
      console.error('[ASSETS-PAGE DEBUG]', debugLog.join('\n'))
    }

    debugLog.push(`[ASSETS-PAGE] User: ${user ? `found (id: ${user.id}, email: ${user.email})` : 'not found'}`)

    if (!user) {
      debugLog.push(`[ASSETS-PAGE] No user, redirecting to login`)
      console.error('[ASSETS-PAGE DEBUG]', debugLog.join('\n'))
      router.push("/login")
      return
    }

    // Parallelliser: Check role and get client IDs in one query
    debugLog.push(`[ASSETS-PAGE] Checking user role and fetching client data...`)
    const [clientUsersResult, allClientsResult] = await Promise.all([
      // Get user's client_users with roles
      supabase
        .from("client_users")
        .select(`roles!inner(key), client_id`)
        .eq("user_id", user.id)
        .eq("status", "active"),
      // Pre-fetch all clients (we'll use this if superadmin)
      supabase
        .from("clients")
        .select("id")
        .eq("status", "active")
    ])

    if (clientUsersResult.error) {
      debugLog.push(`[ASSETS-PAGE] Client users query error: ${clientUsersResult.error.message}`)
    }

    const isSuperAdmin =
      clientUsersResult.data?.some((cu: { roles?: { key?: string } }) => cu.roles?.key === "superadmin") || false

    debugLog.push(`[ASSETS-PAGE] Is superadmin: ${isSuperAdmin}`)

    let clientIds: string[] = []

    if (isSuperAdmin) {
      clientIds = allClientsResult.data?.map((c: { id: string }) => c.id) || []
      debugLog.push(`[ASSETS-PAGE] Found ${clientIds.length} clients for superadmin`)
    } else {
      clientIds = clientUsersResult.data?.map((cu: { client_id: string }) => cu.client_id) || []
      debugLog.push(`[ASSETS-PAGE] Found ${clientIds.length} clients for user`)
    }

    debugLog.push(`[ASSETS-PAGE] Client IDs: ${clientIds.join(', ')}`)

    // Parallelliser: Fetch assets and category tags simultaneously
    debugLog.push(`[ASSETS-PAGE] Fetching assets and category tags in parallel...`)
    const [assetsResult, categoryTagsResult] = await Promise.all([
      supabase
        .from("assets")
        .select(`
          id,
          title,
          storage_path,
          mime_type,
          created_at,
          file_size,
          category_tag_id,
          current_version:asset_versions!current_version_id (
            thumbnail_path
          )
        `)
        .in("client_id", clientIds)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("tags")
        .select("id, label, slug")
        .eq("tag_type", "category")
        .or(`is_system.eq.true,client_id.in.(${clientIds.join(",")})`)
        .order("sort_order", { ascending: true })
    ])

    const assetsData = assetsResult.data || []
    const categoryTags = categoryTagsResult.data || []

    if (assetsResult.error) {
      debugLog.push(`[ASSETS-PAGE] Assets query error: ${assetsResult.error.message}`)
      console.error('[ASSETS-PAGE DEBUG]', debugLog.join('\n'))
    }

    debugLog.push(`[ASSETS-PAGE] Found ${assetsData.length} assets`)
    
    if (assetsData.length > 0) {
      debugLog.push(`[ASSETS-PAGE] Sample assets:`)
      assetsData.slice(0, 3).forEach((asset: Asset, index: number) => {
        debugLog.push(`[ASSETS-PAGE]   Asset ${index + 1}: id=${asset.id}, title=${asset.title}, storage_path=${asset.storage_path}, mime_type=${asset.mime_type}`)
      })
    }

    if (categoryTagsResult.error) {
      debugLog.push(`[ASSETS-PAGE] Category tags query error: ${categoryTagsResult.error.message}`)
    }

    debugLog.push(`[ASSETS-PAGE] Found ${categoryTags.length} category tags`)

    if (assetsData) {
      setAssets(assetsData)
      setFilteredAssets(assetsData)
    }

    if (categoryTags && assetsData) {
      // Build collections from category tags
      const collectionsWithCounts: Collection[] = categoryTags
        .map((tag: { id: string; label: string; slug: string }) => {
          const tagAssets = assetsData.filter((a: Asset) => a.category_tag_id === tag.id)
          return {
            id: tag.id,
            label: tag.label,
            slug: tag.slug,
            assetCount: tagAssets.length,
            previewAssets: tagAssets.slice(0, 4).map((asset: Asset) => ({
              ...asset,
              thumbnail_path: asset.current_version?.thumbnail_path || null
            })), // First 4 assets for preview
          }
        })
        .filter((c: Collection) => c.assetCount > 0) // Only show collections with assets

      debugLog.push(`[ASSETS-PAGE] Created ${collectionsWithCounts.length} collections`)
      setCollections(collectionsWithCounts)
      setFilteredCollections(collectionsWithCounts)
    }

    // Batch fetch signed URLs for assets that need them
    const assetsWithMedia = assetsData.filter((asset: Asset) =>
      asset.mime_type?.startsWith("image/") ||
      asset.mime_type?.startsWith("video/") ||
      asset.mime_type === "application/pdf"
    )

    if (assetsWithMedia.length > 0) {
      debugLog.push(`[ASSETS-PAGE] Batch fetching signed URLs for ${assetsWithMedia.length} assets...`)
      
      try {
        const assetIds = assetsWithMedia.map((a: Asset) => a.id)
        const storagePaths = assetsWithMedia.map((a: Asset) => a.storage_path).filter(Boolean)
        
        const batchResponse = await fetch('/api/assets/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            storagePaths,
            assetIds 
          })
        })
        
        if (batchResponse.ok) {
          const { signedUrls } = await batchResponse.json()
          setSignedUrlsCache(signedUrls)
          setSignedUrlsReady(true) // Mark signed URLs as ready
          debugLog.push(`[ASSETS-PAGE] Got ${Object.keys(signedUrls).length} signed URLs`)
        } else {
          debugLog.push(`[ASSETS-PAGE] Batch signed URL request failed: ${batchResponse.status}`)
          // Even if batch fails, mark as ready to avoid infinite loading
          setSignedUrlsReady(true)
        }
      } catch (error) {
        debugLog.push(`[ASSETS-PAGE] Error fetching signed URLs: ${error}`)
        // Mark as ready even on error to avoid infinite loading
        setSignedUrlsReady(true)
      }
    } else {
      // No assets to load, mark as ready immediately
      setSignedUrlsReady(true)
    }

    debugLog.push(`[ASSETS-PAGE] LoadData completed`)
    console.log('[ASSETS-PAGE DEBUG]', debugLog.join('\n'))

    const totalAssetsToLoad = assetsWithMedia.length
    setTotalAssets(totalAssetsToLoad)
    setLoadedAssets(0) // Reset counter
    setSignedUrlsReady(false) // Reset signed URLs ready state

    // If no assets need to be loaded, hide skeleton immediately
    if (totalAssetsToLoad === 0) {
      setIsLoading(false)
      setSignedUrlsReady(true)
      setShouldAnimate(true) // Start animation immediately if no assets to load
    }
    // Otherwise, wait for smart threshold in handleAssetLoaded
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

  const handleApplyFilters = async (filters: {
    categoryTags: string[]
    descriptionTags: string[]
    usageTags: string[]
    visualStyleTags: string[]
    fileTypeTags: string[]
  }) => {
    const allSelectedTags = [
      ...filters.categoryTags,
      ...filters.fileTypeTags,
      ...filters.descriptionTags,
      ...filters.usageTags,
      ...filters.visualStyleTags,
    ]

    const supabase = supabaseRef.current

    // Filter assets
    let filteredAssets = [...assets]

    if (allSelectedTags.length > 0) {
      // Filter by category tags directly on assets
      if (filters.categoryTags.length > 0) {
        filteredAssets = filteredAssets.filter(
          (asset) => asset.category_tag_id && filters.categoryTags.includes(asset.category_tag_id),
        )
      }

      // Filter by other tags via asset_tags junction (includes file types)
      const otherTags = [
        ...filters.descriptionTags,
        ...filters.usageTags,
        ...filters.visualStyleTags,
        ...filters.fileTypeTags,
      ]

      if (otherTags.length > 0) {
        const { data: assetTags } = await supabase.from("asset_tags").select("asset_id").in("tag_id", otherTags)

    const assetIds = [...new Set(assetTags?.map((at: { asset_id: string }) => at.asset_id) || [])]
        filteredAssets = filteredAssets.filter((asset) => assetIds.includes(asset.id))
      }
    }

    // Filter collections based on the filtered assets
    let filteredCollectionsResult = [...collections]

    if (allSelectedTags.length > 0) {
      // Get all unique category IDs from the filtered assets
      const filteredCategoryIds = [...new Set(filteredAssets.map(asset => asset.category_tag_id).filter(id => id))]

      // Only show collections that have assets in the filtered results
      filteredCollectionsResult = collections.filter((collection) =>
        filteredCategoryIds.includes(collection.id)
      )
    }

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
            <Link href="/assets/collections" className="text-sm text-gray-500 hover:text-gray-700">
              See all collections →
            </Link>
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
          <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {sortedCollections.slice(0, maxCollections).map((collection, index) => (
              <div
                key={collection.id}
                className={shouldAnimate ? 'animate-stagger-fade-in' : 'opacity-0'}
                style={shouldAnimate ? {
                  animationDelay: `${Math.min(index * 40, 600)}ms`,
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
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {filteredAssets.length} Asset{filteredAssets.length !== 1 ? "s" : ""}
            </h2>
            <Link href="/assets" className="text-sm text-gray-500 hover:text-gray-700">
              See all assets →
            </Link>
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
            <Link href="/assets/upload">
              <Button className="mt-4 bg-[#dc3545] hover:bg-[#c82333]">Upload your first asset</Button>
            </Link>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-4 gap-6">
            {filteredAssets.map((asset, index) => {
              // Show all assets once signed URLs are ready
              // Animation only starts when shouldAnimate is true
              return (
              <Link 
                key={asset.id} 
                href={`/assets/${asset.id}?context=all`} 
                className={`block mb-6 break-inside-avoid ${shouldAnimate ? 'animate-stagger-fade-in' : 'opacity-0'}`}
                style={shouldAnimate ? {
                  animationDelay: `${Math.min(index * 40, 600)}ms`,
                } : {}}
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
              )
            })}
          </div>
        )}
      </div>

      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onApplyFilters={handleApplyFilters} />
    </div>
  )
}
