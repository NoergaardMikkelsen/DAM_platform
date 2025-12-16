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
import { AssetGridSkeleton, CollectionGridSkeleton, PageHeaderSkeleton, SectionHeaderSkeleton } from "@/components/skeleton-loaders"
import { useState, useEffect, useRef } from "react"
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
  const router = useRouter()
  const supabaseRef = useRef(createClient())

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

    // Check if user is superadmin
    debugLog.push(`[ASSETS-PAGE] Checking user role...`)
    const { data: clientUsers, error: clientUsersError } = await supabase
      .from("client_users")
      .select(`roles!inner(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")

    if (clientUsersError) {
      debugLog.push(`[ASSETS-PAGE] Client users query error: ${clientUsersError.message}`)
    }

    const isSuperAdmin =
      clientUsers?.some((cu: { roles?: { key?: string } }) => cu.roles?.key === "superadmin") || false

    debugLog.push(`[ASSETS-PAGE] Is superadmin: ${isSuperAdmin}`)

    let clientIds: string[] = []

    if (isSuperAdmin) {
      // Superadmin can see all clients
      debugLog.push(`[ASSETS-PAGE] Fetching all clients for superadmin...`)
      const { data: allClients, error: allClientsError } = await supabase
        .from("clients")
        .select("id")
        .eq("status", "active")
      
      if (allClientsError) {
        debugLog.push(`[ASSETS-PAGE] All clients query error: ${allClientsError.message}`)
      }
      
      clientIds = allClients?.map((c: { id: string }) => c.id) || []
      debugLog.push(`[ASSETS-PAGE] Found ${clientIds.length} clients for superadmin`)
    } else {
      // Regular users see only their clients
      debugLog.push(`[ASSETS-PAGE] Fetching user's clients...`)
      const { data: clientUsers, error: clientUsersError2 } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("status", "active")
      
      if (clientUsersError2) {
        debugLog.push(`[ASSETS-PAGE] Client users query error: ${clientUsersError2.message}`)
      }
      
      clientIds = clientUsers?.map((cu: { client_id: string }) => cu.client_id) || []
      debugLog.push(`[ASSETS-PAGE] Found ${clientIds.length} clients for user`)
    }

    debugLog.push(`[ASSETS-PAGE] Client IDs: ${clientIds.join(', ')}`)

    debugLog.push(`[ASSETS-PAGE] Fetching assets...`)
    const { data: assetsData, error: assetsError } = await supabase
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
      .order("created_at", { ascending: false })

    if (assetsError) {
      debugLog.push(`[ASSETS-PAGE] Assets query error: ${assetsError.message}`)
      console.error('[ASSETS-PAGE DEBUG]', debugLog.join('\n'))
    }

    debugLog.push(`[ASSETS-PAGE] Found ${assetsData?.length || 0} assets`)
    
    if (assetsData && assetsData.length > 0) {
      debugLog.push(`[ASSETS-PAGE] Sample assets:`)
      assetsData.slice(0, 3).forEach((asset: Asset, index: number) => {
        debugLog.push(`[ASSETS-PAGE]   Asset ${index + 1}: id=${asset.id}, title=${asset.title}, storage_path=${asset.storage_path}, mime_type=${asset.mime_type}`)
      })
    }

    if (assetsData) {
      setAssets(assetsData)
      setFilteredAssets(assetsData)
    }

    debugLog.push(`[ASSETS-PAGE] Fetching category tags...`)
    const { data: categoryTags, error: categoryTagsError } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("tag_type", "category")
      .or(`is_system.eq.true,client_id.in.(${clientIds.join(",")})`)
      .order("sort_order", { ascending: true })

    if (categoryTagsError) {
      debugLog.push(`[ASSETS-PAGE] Category tags query error: ${categoryTagsError.message}`)
    }

    debugLog.push(`[ASSETS-PAGE] Found ${categoryTags?.length || 0} category tags`)

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

    debugLog.push(`[ASSETS-PAGE] LoadData completed`)
    console.log('[ASSETS-PAGE DEBUG]', debugLog.join('\n'))

    // Add small delay to ensure collection images have time to load
    setTimeout(() => setIsLoading(false), 1000)
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

  if (isLoading) {
    return (
      <div className="p-8">
        <PageHeaderSkeleton showSearch={true} />

        {/* Collections section skeleton */}
        <div className="mb-10">
          <SectionHeaderSkeleton showSort={true} />
          <CollectionGridSkeleton count={maxCollections} />
        </div>

        {/* Assets section skeleton */}
        <div>
          <SectionHeaderSkeleton showSort={true} />
          <AssetGridSkeleton count={12} />
        </div>

        <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onApplyFilters={handleApplyFilters} />
      </div>
    )
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
            {filteredAssets.map((asset) => (
              <Link key={asset.id} href={`/assets/${asset.id}?context=all`} className="block mb-6 break-inside-avoid">
                <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg mb-6">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200">
                    {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/") || asset.mime_type === "application/pdf") && asset.storage_path && (
                      <AssetPreview
                        storagePath={asset.storage_path}
                        mimeType={asset.mime_type}
                        alt={asset.title}
                        className={asset.mime_type === "application/pdf" ? "w-full h-auto" : "w-full h-full object-cover"}
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

      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} onApplyFilters={handleApplyFilters} />
    </div>
  )
}
