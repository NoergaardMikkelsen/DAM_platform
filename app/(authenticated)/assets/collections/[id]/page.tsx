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
import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
  created_at: string
  file_size: number
  category_tag_id: string | null
}

type ClientUserRoleRow = {
  roles?: { key?: string | null } | null
}

type ClientIdRow = { id: string }
type ClientUserRow = { client_id: string }
type AssetTagRow = { asset_id: string }

export default function CollectionDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [collectionName, setCollectionName] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

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

    // Get the collection (category tag) info
    const { data: tag } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("id", id)
      .eq("tag_type", "category")
      .single()

    if (!tag) {
      router.push("/assets")
      return
    }

    setCollectionName(tag.label)

    // Check if user is superadmin
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select(`roles!inner(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")

    const isSuperAdmin =
      (clientUsers as ClientUserRoleRow[] | null)?.some((cu) => cu.roles?.key === "superadmin") || false

    let clientIds: string[] = []

    if (isSuperAdmin) {
      // Superadmin can see all clients
      const { data: allClients } = await supabase
        .from("clients")
        .select("id")
        .eq("status", "active")
      clientIds = (allClients as ClientIdRow[] | null)?.map((c) => c.id) || []
    } else {
      // Regular users see only their clients
      const { data: clientUsers } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("status", "active")
      clientIds = (clientUsers as ClientUserRow[] | null)?.map((cu) => cu.client_id) || []
    }

    // Get all assets in this collection (with this category tag)
    const { data: assetsData } = await supabase
      .from("assets")
      .select("id, title, storage_path, mime_type, created_at, file_size, category_tag_id")
      .in("client_id", clientIds)
      .eq("category_tag_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (assetsData) {
      setAssets(assetsData)
      setFilteredAssets(assetsData)
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

  const handleApplyFilters = async (filters: {
    categoryTags: string[]
    descriptionTags: string[]
    usageTags: string[]
    visualStyleTags: string[]
  }) => {
    const otherTags = [...filters.descriptionTags, ...filters.usageTags, ...filters.visualStyleTags]

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

  return (
    <div className="p-8">
      {/* Header with back button */}
      <div className="mb-8">
        <Link href="/assets" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Assets Library
        </Link>

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
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square animate-pulse bg-gray-200" />
            </Card>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-600">No assets found in this collection</p>
          <Link href="/assets/upload">
            <Button className="mt-4 bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">Upload assets to this collection</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {filteredAssets.map((asset) => (
            <Link key={asset.id} href={`/assets/${asset.id}?context=collection&collectionId=${params.id}`}>
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

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={handleApplyFilters}
        showCategoryFilter={false}
      />
    </div>
  )
}
