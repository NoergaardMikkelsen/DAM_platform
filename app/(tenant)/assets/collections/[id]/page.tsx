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
  const params = useParams() as { id: string }
  const id = params.id

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
          if (!shouldAnimate) {
            setShouldAnimate(true)
          }
        }
      }
      
      return newCount
    })
  }, [totalAssets, signedUrlsReady])

  useEffect(() => {
    if (!id || id === "undefined") return
    loadData()
  }, [id])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])

  const loadData = async () => {
    if (!id || id === "undefined") {
      setIsLoading(false)
      return
    }

    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Try to get client ID from tenant context, fallback to lookup
    let clientId: string

    if (tenant?.id) {
      clientId = tenant.id
    } else {
      // Fallback: lookup client_id from client_users table
      const supabase = supabaseRef.current
      const {
        data: user,
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError("Authentication required")
        setIsLoading(false)
        return
      }

      const { data: clientUsers, error: clientError } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single()

      if (clientError || !clientUsers?.client_id) {
        setError("No active client found")
        setIsLoading(false)
        return
      }

      clientId = clientUsers.client_id
    }

    // Fetch collection tag (any tag that generates collections)
    const { data: tag } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("id", id)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .single()

    if (!tag) {
      router.push("/assets")
      return
    }

    setCollectionName(tag.label)

    // Get all assets in this collection (via asset_tags junction table)
    const { data: assetTags } = await supabase
      .from("asset_tags")
      .select("asset_id")
      .eq("tag_id", id)

    const assetIds = assetTags?.map((at: any) => at.asset_id) || []

    if (assetIds.length === 0) {
      setAssets([])
      setFilteredAssets([])
      setIsLoading(false)
      return
    }

    const { data: assetsData } = await supabase
      .from("assets")
      .select("id, title, storage_path, mime_type, created_at, file_size")
      .eq("client_id", clientId)
      .in("id", assetIds)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (assetsData) {
      setAssets(assetsData)
      setFilteredAssets(assetsData)

      // Batch fetch signed URLs for assets that need them
      const assetsWithMedia = (assetsData || []).filter((asset: Asset) =>
        asset.mime_type?.startsWith("image/") ||
        asset.mime_type?.startsWith("video/") ||
        asset.mime_type === "application/pdf"
      )

      if (assetsWithMedia.length > 0) {
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
            setSignedUrlsReady(true)
            
            // Start animation after a short delay to ensure assets are rendered
            setTimeout(() => {
              setShouldAnimate(true)
            }, 200)
          } else {
            setSignedUrlsReady(true) // Mark as ready even on error
            setTimeout(() => {
              setShouldAnimate(true)
            }, 200)
          }
        } catch (error) {
          console.error("Error fetching signed URLs:", error)
          setSignedUrlsReady(true) // Mark as ready even on error
          setTimeout(() => {
            setShouldAnimate(true)
          }, 200)
        }
      } else {
        setSignedUrlsReady(true) // No assets to load
        setTimeout(() => {
          setShouldAnimate(true)
        }, 200)
      }

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
            variant="outline"
            className="rounded-[25px]"
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
            <Button variant="outline" className="rounded-[25px] cursor-pointer" onClick={() => setIsFilterOpen(true)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {filteredAssets.map((asset, index) => {
            // Always render assets, but control animation timing
            return (
            <Link 
              key={asset.id} 
              href={`/assets/${asset.id}?context=collection&collectionId=${id}`}
              className="animate-stagger-fade-in"
              style={{
                animationDelay: `${Math.min(index * 40, 600)}ms`,
              }}
            >
              <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg">
                <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200">
                  {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path && (
                    <AssetPreview
                      storagePath={asset.storage_path}
                      mimeType={asset.mime_type}
                      alt={asset.title}
                      className="h-full w-full object-cover"
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

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={handleApplyFilters}
        showCategoryFilter={false}
      />
    </div>
  )
}
