"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CollectionCard } from "@/components/collection-card"
import { CollectionGridSkeleton, PageHeaderSkeleton, SortingSkeleton } from "@/components/skeleton-loaders"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"

interface Asset {
  id: string
  title: string
  storage_path: string
  mime_type: string
  thumbnail_path?: string | null
}

interface Collection {
  id: string
  label: string
  slug: string
  assetCount: number
  previewAssets: Asset[]
}

export default function CollectionsPage() {
  const { tenant } = useTenant()
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [isLoading, setIsLoading] = useState(true)
  const [maxCollections, setMaxCollections] = useState(3)
  const router = useRouter()

  console.log('[COLLECTIONS PAGE] Rendering with tenant:', tenant, 'window.location:', typeof window !== 'undefined' ? window.location.href : 'server')
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applySearchAndSort()
  }, [collections, searchQuery, sortBy])

  useEffect(() => {
    const updateMaxCollections = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth
        // Calculate how many 200px+ cards can fit
        const availableWidth = width - 64 // Account for padding
        const cardWidth = 200 + 32 // 200px min card + 32px gap
        const maxCols = Math.floor(availableWidth / cardWidth)

        // For collections page, allow more columns since users can scroll
        setMaxCollections(Math.min(Math.max(maxCols, 2), 6)) // Allow up to 6 on collections page
      }
    }

    updateMaxCollections()
    window.addEventListener('resize', updateMaxCollections)
    return () => window.removeEventListener('resize', updateMaxCollections)
  }, [])

  const loadData = async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    // Parallelliser: Fetch assets and category tags simultaneously
    const [assetsResult, categoryTagsResult] = await Promise.all([
      supabase
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
        .eq("client_id", clientId)
        .eq("status", "active"),
      supabase
        .from("tags")
        .select("id, label, slug")
        .eq("tag_type", "category")
        .or(`client_id.is.null,client_id.eq.${clientId}`)
        .order("sort_order", { ascending: true })
    ])

    const assetsData = assetsResult.data || []
    const categoryTags = categoryTagsResult.data || []

    if (categoryTags && assetsData) {
      const collectionsWithCounts: Collection[] = categoryTags
        .map((tag: any) => {
          const tagAssets = assetsData.filter((a: any) => a.category_tag_id === tag.id)
          return {
            id: tag.id,
            label: tag.label,
            slug: tag.slug,
            assetCount: tagAssets.length,
            previewAssets: tagAssets.slice(0, 4).map((asset: any) => ({
              ...asset,
              thumbnail_path: asset.current_version?.thumbnail_path || null
            })),
          }
        })
        .filter((c: any) => c.assetCount > 0)

      setCollections(collectionsWithCounts)
      setFilteredCollections(collectionsWithCounts)
    }

    // Add small delay to ensure collection images have time to load
    setTimeout(() => setIsLoading(false), 1000)
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

  if (isLoading) {
    return (
      <div className="p-8">
        <PageHeaderSkeleton showBackLink={true} showSearch={true} />
        <SortingSkeleton />
        <CollectionGridSkeleton count={12} />
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      {/* Header */}
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
              className="pl-10"
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
      {filteredCollections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-600">No collections found</p>
          <Link href="/assets/upload">
            <Button className="mt-4 bg-transparent hover:bg-transparent border-0" style={{ backgroundColor: tenant.primary_color, color: 'white' }}>Upload assets to create collections</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 260px))' }}>
          {filteredCollections.map((collection) => (
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
  )
}
