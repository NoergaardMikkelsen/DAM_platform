"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, Search, ArrowRight, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { AssetPreview } from "@/components/asset-preview"
import { FilterPanel } from "@/components/filter-panel"
import { AssetGridSkeleton } from "@/components/skeleton-loaders"
import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
  created_at: string
  file_size: number
}

type ClientUserRoleRow = {
  roles?: { key?: string | null } | null
}

type ClientIdRow = { id: string }
type ClientUserRow = { client_id: string }
type AssetTagRow = { asset_id: string }

export default function CollectionDetailPage() {
  const { tenant } = useTenant()
  const params = useParams() as { id?: string }
  const id = params?.id

  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [collectionName, setCollectionName] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
          setShouldAnimate(true)
        }
      }
      
      return newCount
    })
  }, [totalAssets, signedUrlsReady, shouldAnimate])

  useEffect(() => {
    // Wait for tenant to be available before loading data
    // This prevents server-side errors when tenant context isn't ready yet
    if (!tenant?.id || !id || id === "undefined") {
      setIsLoading(true)
      return
    }
    
    // Only load data when both tenant and id are ready
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tenant?.id])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])

  const loadData = async () => {
    try {
      if (!id || id === "undefined") {
        setIsLoading(false)
        return
      }

      // Guard: ensure tenant is available before proceeding
      if (!tenant?.id) {
        setIsLoading(false)
        return
      }

      const supabase = supabaseRef.current
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setIsLoading(false)
        router.push("/login")
        return
      }

      // Get client ID from tenant context (should always be available)
      const clientId = tenant.id

      if (!clientId) {
        setError("No active client found")
        setIsLoading(false)
        return
      }

      // Fetch collection tag (any tag that generates collections)
      const { data: tag, error: tagError } = await supabase
        .from("tags")
        .select("id, label, slug")
        .eq("id", id)
        .or(`client_id.eq.${clientId},client_id.is.null`)
        .single()

      if (tagError || !tag) {
        console.error('[COLLECTION-PAGE] Error fetching tag:', tagError)
        setIsLoading(false)
        router.push("/assets")
        return
      }

      setCollectionName(tag.label)

      // Get all assets in this collection (via asset_tags junction table)
      const { data: assetTags, error: assetTagsError } = await supabase
        .from("asset_tags")
        .select("asset_id")
        .eq("tag_id", id)

      if (assetTagsError) {
        console.error('[COLLECTION-PAGE] Error fetching asset tags:', assetTagsError)
        setError("Failed to load collection assets")
        setIsLoading(false)
        return
      }

      const assetIds = assetTags?.map((at: any) => at.asset_id) || []

      if (assetIds.length === 0) {
        setAssets([])
        setFilteredAssets([])
        setIsLoading(false)
        setSignedUrlsReady(true)
        setShouldAnimate(true)
        return
      }

      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select("id, title, storage_path, mime_type, created_at, file_size")
        .eq("client_id", clientId)
        .in("id", assetIds)
        .eq("status", "active")
        .order("created_at", { ascending: false })

      if (assetsError) {
        console.error('[COLLECTION-PAGE] Error fetching assets:', assetsError)
        setError("Failed to load collection assets")
        setIsLoading(false)
        return
      }

      if (!assetsData) {
        setAssets([])
        setFilteredAssets([])
        setIsLoading(false)
        setSignedUrlsReady(true)
        setShouldAnimate(true)
        return
      }

      setAssets(assetsData)
      setFilteredAssets(assetsData)

      // Batch fetch signed URLs for assets that need them
      const assetsWithMedia = (assetsData || []).filter((asset: Asset) =>
        asset.mime_type?.startsWith("image/") ||
        asset.mime_type?.startsWith("video/") ||
        asset.mime_type === "application/pdf"
      )

      const totalAssetsToLoad = assetsWithMedia.length
      setTotalAssets(totalAssetsToLoad)
      setLoadedAssets(0) // Reset counter

      // If no assets need to be loaded, hide skeleton immediately
      if (totalAssetsToLoad === 0) {
        setIsLoading(false)
        setSignedUrlsReady(true)
        setShouldAnimate(true) // Start animation immediately if no assets to load
        return
      }

      // Fetch signed URLs in background - don't await, let it load asynchronously
      // This matches the pattern from asset library page for consistency
      if (assetsWithMedia.length > 0) {
        const assetIdsForUrls = assetsWithMedia.map((a: Asset) => a.id).filter(Boolean)
        const storagePaths = assetsWithMedia.map((a: Asset) => a.storage_path).filter(Boolean)
        
        console.log(`[COLLECTION-PAGE] Fetching signed URLs for ${assetIdsForUrls.length} assets`)
        
        // Chunk large batches to avoid timeout (process in chunks of 50)
        const BATCH_SIZE = 50
        const chunks: Array<{ assetIds: string[], storagePaths: string[] }> = []
        
        for (let i = 0; i < assetIdsForUrls.length; i += BATCH_SIZE) {
          chunks.push({
            assetIds: assetIdsForUrls.slice(i, i + BATCH_SIZE),
            storagePaths: storagePaths.slice(i, i + BATCH_SIZE)
          })
        }
        
        // Process chunks sequentially to avoid overwhelming the API
        const processChunks = async () => {
          const allSignedUrls: Record<string, string> = {}
          
          for (const chunk of chunks) {
            try {
              const response = await fetch('/api/assets/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  storagePaths: chunk.storagePaths,
                  assetIds: chunk.assetIds 
                })
              })
              
              if (response.ok) {
                const { signedUrls } = await response.json()
                if (signedUrls) {
                  Object.assign(allSignedUrls, signedUrls)
                  // Update cache incrementally as chunks complete
                  setSignedUrlsCache(prev => ({ ...prev, ...signedUrls }))
                }
              } else {
                console.warn(`[COLLECTION-PAGE] Batch chunk failed with status ${response.status}`)
              }
            } catch (error) {
              console.error(`[COLLECTION-PAGE] Error fetching chunk:`, error)
            }
          }
          
          const urlCount = Object.keys(allSignedUrls).length
          console.log(`[COLLECTION-PAGE] Received ${urlCount} signed URLs out of ${assetIdsForUrls.length} requested`)
          setSignedUrlsReady(true)
          setShouldAnimate(true)
        }
        
        // Start processing chunks asynchronously
        processChunks().catch((error) => {
          console.error('[COLLECTION-PAGE] Error processing chunks:', error)
          // Mark as ready even on error - assets will use fallback/proxy URLs via BatchAssetLoader
          setSignedUrlsReady(true)
          setShouldAnimate(true)
        })
      } else {
        // No media assets to load
        setSignedUrlsReady(true)
        setShouldAnimate(true)
      }
      
      // Show content immediately - don't wait for signed URLs
      // Assets will load progressively as signed URLs become available
      setIsLoading(false)
      setShouldAnimate(true)
    } catch (error) {
      // Handle any unexpected errors during data loading
      console.error('[COLLECTION-PAGE] Unexpected error loading data:', error)
      setError("Failed to load collection. Please try again.")
      setIsLoading(false)
      setSignedUrlsReady(true)
      setShouldAnimate(true)
    }
  }

  const applySearchAndSort = () => {
    const { filterBySearch, sortItems } = require("@/lib/utils/sorting")
    let filtered = filterBySearch(assets, searchQuery, ["title"])
    filtered = sortItems(filtered, sortBy as any)
    setFilteredAssets(filtered)
  }

  const handleApplyFilters = async (filters: Record<string, string[]>) => {
    const otherTags = Object.values(filters).flat()

    if (otherTags.length === 0) {
      setFilteredAssets(assets)
      setIsFilterOpen(false)
      return
    }

    const supabase = supabaseRef.current

    // Filter by tags via asset_tags junction
    const { data: assetTags } = await supabase.from("asset_tags").select("asset_id").in("tag_id", otherTags)

    const assetIds = [...new Set((assetTags as AssetTagRow[] | null)?.map((at) => at.asset_id) || [])]
    const filtered = assets.filter((asset) => assetIds.includes(asset.id))

    setFilteredAssets(filtered)
    setIsFilterOpen(false)
  }

  // Show error if tenant is not available
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button
            onClick={() => router.push('/assets')}
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assets
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header with back button */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/assets')}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assets Library
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{collectionName || "Collection"}</h1>
            <p className="mt-1 text-gray-500">
              {filteredAssets.length} asset{filteredAssets.length !== 1 ? "s" : ""} in this collection
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setIsFilterOpen(true)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <Input
                type="search"
                placeholder="Search in collection"
                className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sorting */}
      <div className="mb-6 flex items-center justify-end">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]" suppressHydrationWarning>
            <SelectValue placeholder="Sort assets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Sort by Newest</SelectItem>
            <SelectItem value="oldest">Sort by Oldest</SelectItem>
            <SelectItem value="name">Sort by Name</SelectItem>
            <SelectItem value="size">Sort by Size</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Grid */}
      {!shouldAnimate ? (
        // Show skeleton while waiting for animation to start
        <AssetGridSkeleton count={Math.min(15, assets.length || 15)} />
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-600">No assets found in this collection</p>
        </div>
      ) : (
        <div className="gap-4 sm:gap-6 grid grid-cols-2 xl:grid-cols-4">
          {filteredAssets.map((asset, index) => {
            // Always render assets, but control animation timing
            return (
            <Link 
              key={asset.id} 
              href={`/assets/${asset.id}?context=collection&collectionId=${id}`}
              className="animate-stagger-fade-in w-full"
              style={{
                animationDelay: `${Math.min(index * 25, 200)}ms`,
              }}
            >
              <Card className="group overflow-hidden p-0 transition-shadow w-full" style={{ borderRadius: '20px' }}>
                <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 w-full" style={{ borderRadius: '20px' }}>
                  {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path && (
                    <AssetPreview
                      key={`${asset.id}-${signedUrlsCache?.[asset.storage_path] ? 'cached' : 'loading'}`} // Force re-render when cache updates
                      storagePath={asset.storage_path}
                      mimeType={asset.mime_type}
                      alt={asset.title}
                      className={asset.mime_type === "application/pdf" ? "w-full h-full object-contain absolute inset-0" : "w-full h-full object-cover absolute inset-0"}
                      style={{ borderRadius: '20px' }}
                      signedUrl={signedUrlsCache?.[asset.storage_path] || undefined} // Pass cached signed URL if available
                      showLoading={false}
                      onAssetLoaded={handleAssetLoaded}
                    />
                  )}
                  {!(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && (
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

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={handleApplyFilters}
        showCategoryFilter={false}
      />
    </div>
  )
}
