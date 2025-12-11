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
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applySearchAndSort()
  }, [assets, searchQuery, sortBy])

  const loadData = async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Check if user is superadmin
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select(`roles!inner(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")

    const isSuperAdmin =
      clientUsers?.some((cu: { roles?: { key?: string } }) => cu.roles?.key === "superadmin") || false

    let clientIds: string[] = []

    if (isSuperAdmin) {
      // Superadmin can see all clients
      const { data: allClients } = await supabase
        .from("clients")
        .select("id")
        .eq("status", "active")
      clientIds = allClients?.map((c: { id: string }) => c.id) || []
    } else {
      // Regular users see only their clients
      const { data: clientUsers } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("status", "active")
      clientIds = clientUsers?.map((cu: { client_id: string }) => cu.client_id) || []
    }

    const { data: assetsData } = await supabase
      .from("assets")
      .select("id, title, storage_path, mime_type, created_at, file_size, category_tag_id")
      .in("client_id", clientIds)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (assetsData) {
      setAssets(assetsData)
      setFilteredAssets(assetsData)
    }

    const { data: categoryTags } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("tag_type", "category")
      .or(`is_system.eq.true,client_id.in.(${clientIds.join(",")})`)
      .order("sort_order", { ascending: true })

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
            previewAssets: tagAssets.slice(0, 4), // First 4 assets for preview
          }
        })
        .filter((c: Collection) => c.assetCount > 0) // Only show collections with assets

      setCollections(collectionsWithCounts)
      setFilteredCollections(collectionsWithCounts)
    }

    setIsLoading(false)
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
          <Button variant="outline" className="rounded-[25px] cursor-pointer" onClick={() => setIsFilterOpen(true)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search assets"
            className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
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

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-[4/3] animate-pulse bg-gray-200" />
              </Card>
            ))}
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">No collections yet. Upload assets with category tags to create collections.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {sortedCollections.slice(0, 4).map((collection) => (
              <Link key={collection.id} href={`/assets/collections/${collection.id}`}>
                <Card className="group relative overflow-hidden p-0 transition-shadow hover:shadow-lg">
                  {/* Preview Grid */}
                  <div className="relative aspect-square bg-gray-100">
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
                      {collection.previewAssets.slice(0, 4).map((asset, idx) => (
                        <div key={asset.id} className="relative overflow-hidden bg-gray-200">
                          {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/")) && asset.storage_path && (
                            <AssetPreview
                              storagePath={asset.storage_path}
                              mimeType={asset.mime_type}
                              alt={asset.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                      {/* Fill empty slots */}
                      {[...Array(Math.max(0, 4 - collection.previewAssets.length))].map((_, idx) => (
                        <div key={`empty-${idx}`} className="bg-gray-200" />
                      ))}
                    </div>

                    {/* Overlay with collection info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-semibold text-white">{collection.label}</h3>
                      <p className="text-sm text-white/80">{collection.assetCount} assets</p>
                    </div>

                    {/* Favorite button */}
                    <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 opacity-0 transition-opacity hover:bg-white hover:text-[#DF475C] group-hover:opacity-100">
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Bottom action bar */}
                  <div className="flex items-center justify-between border-t bg-white p-3">
                    <span className="text-sm text-gray-600">Se hele kampagnen</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors cursor-pointer group-hover:bg-[#DF475C] group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Card>
              </Link>
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

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-square animate-pulse bg-gray-200" />
                <CardHeader className="p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600">No assets found</p>
            <Link href="/assets/upload">
              <Button className="mt-4 bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">Upload your first asset</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {filteredAssets.map((asset) => (
              <Link key={asset.id} href={`/assets/${asset.id}?context=all`}>
                <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg">
                  <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200">
                    {(asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/")) && asset.storage_path && (
                      <AssetPreview
                        storagePath={asset.storage_path}
                        mimeType={asset.mime_type}
                        alt={asset.title}
                        className="h-full w-full object-cover"
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
