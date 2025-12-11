"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Heart, ArrowRight, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { AssetPreview } from "@/components/asset-preview"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
}

interface Collection {
  id: string
  label: string
  slug: string
  assetCount: number
  previewAssets: Asset[]
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applySearchAndSort()
  }, [collections, searchQuery, sortBy])

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

    const isSuperAdmin = clientUsers?.some((cu: any) => cu.roles?.key === "superadmin") || false

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
        .select("client_id")
        .eq("user_id", user.id)
        .eq("status", "active")
      clientIds = clientUsers?.map((cu: any) => cu.client_id) || []
    }

    // Get all assets for the user's clients
    const { data: assetsData } = await supabase
      .from("assets")
      .select("id, title, storage_path, mime_type, category_tag_id")
      .in("client_id", clientIds)
      .eq("status", "active")

    // Get all category tags
    const { data: categoryTags } = await supabase
      .from("tags")
      .select("id, label, slug")
      .eq("tag_type", "category")
      .or(`is_system.eq.true,client_id.in.(${clientIds.join(",")})`)
      .order("sort_order", { ascending: true })

    if (categoryTags && assetsData) {
      const collectionsWithCounts: Collection[] = categoryTags
        .map((tag: any) => {
          const tagAssets = assetsData.filter((a: any) => a.category_tag_id === tag.id)
          return {
            id: tag.id,
            label: tag.label,
            slug: tag.slug,
            assetCount: tagAssets.length,
            previewAssets: tagAssets.slice(0, 4),
          }
        })
        .filter((c: any) => c.assetCount > 0)

      setCollections(collectionsWithCounts)
      setFilteredCollections(collectionsWithCounts)
    }

    setIsLoading(false)
  }

  const applySearchAndSort = () => {
    let filtered = [...collections]

    if (searchQuery) {
      filtered = filtered.filter((collection) => collection.label.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.assetCount - a.assetCount
        case "oldest":
          return a.assetCount - b.assetCount
        case "name":
          return a.label.localeCompare(b.label)
        default:
          return 0
      }
    })

    setFilteredCollections(filtered)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/assets" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Assets Library
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Collections</h1>
            <p className="mt-1 text-gray-500">
              {filteredCollections.length} collection{filteredCollections.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search collections"
            className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          </div>
        </div>
      </div>

      {/* Sorting */}
      <div className="mb-6 flex items-center justify-end">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]" suppressHydrationWarning>
            <SelectValue placeholder="Sort collections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Sort by Most Assets</SelectItem>
            <SelectItem value="name">Sort by Name</SelectItem>
            <SelectItem value="oldest">Sort by Least Assets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Collections Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[4/3] animate-pulse bg-gray-200" />
            </Card>
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-600">No collections found</p>
          <Link href="/assets/upload">
            <Button className="mt-4 bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">Upload assets to create collections</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {filteredCollections.map((collection) => (
            <Link key={collection.id} href={`/assets/collections/${collection.id}`}>
              <Card className="group relative overflow-hidden p-0 transition-shadow hover:shadow-lg">
                {/* Preview Grid */}
                <div className="relative aspect-square bg-gray-100">
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
                    {collection.previewAssets.slice(0, 4).map((asset) => (
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
                    {[...Array(Math.max(0, 4 - collection.previewAssets.length))].map((_, idx) => (
                      <div key={`empty-${idx}`} className="bg-gray-200" />
                    ))}
                  </div>

                  {/* Overlay */}
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
                  <span className="text-sm text-gray-600">View collection</span>
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
  )
}
