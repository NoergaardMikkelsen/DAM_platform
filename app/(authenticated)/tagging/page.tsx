"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

interface Tag {
  id: string
  label: string
  slug: string
  tag_type: string
  is_system: boolean
  sort_order: number
  client_id: string
  created_by: string | null
  created_at: string
  updated_at: string
  users?: {
    full_name: string
  } | null
  asset_count?: number
}

export default function TaggingPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [filteredTags, setFilteredTags] = useState<Tag[]>([])
  const [tagTypeFilter, setTagTypeFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadTags()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [tags, tagTypeFilter, searchQuery])

  const loadTags = async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Check if user is admin or superadmin
    const { data: userRole } = await supabase
      .from("client_users")
      .select(`roles(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    const role = userRole?.roles?.key

    if (role !== "admin" && role !== "superadmin") {
      router.push("/dashboard")
      return
    }

    // Check if user is superadmin
    const { data: clientUsersCheck } = await supabase
      .from("client_users")
      .select(`roles!inner(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")

    const isSuperAdmin = clientUsersCheck?.some((cu: any) => cu.roles?.key === "superadmin") || false

    let clientId: string | null = null

    if (!isSuperAdmin) {
      // Regular admin - get their client
      const { data: clientUsers } = await supabase
        .from("client_users")
        .select(`client_id`)
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)

      clientId = clientUsers?.[0]?.client_id || null

      if (!clientId) {
        router.push("/dashboard")
        return
      }
    }

    let tagsData: Tag[] = []

    if (isSuperAdmin) {
      // Superadmin sees all tags
      const { data: allTags } = await supabase
        .from("tags")
        .select(
          `
          *,
          users (full_name)
        `,
        )
        .order("tag_type")
        .order("sort_order")

      tagsData = allTags || []
    } else {
      // Regular admin sees client tags + system tags
      const { data: clientTags } = await supabase
        .from("tags")
        .select(
          `
          *,
          users (full_name)
        `,
        )
        .or(`client_id.eq.${clientId},is_system.eq.true`)
        .order("tag_type")
        .order("sort_order")

      tagsData = clientTags || []
    }

    // Get asset counts for each tag
    const tagCountsMap = new Map<string, number>()

    if (tagsData.length > 0) {
      // Get all asset_tags for these tags
      const { data: assetTags } = await supabase.from("asset_tags").select("tag_id").in(
        "tag_id",
        tagsData.map((t) => t.id),
      )

      // Count occurrences of each tag_id
      if (assetTags) {
        assetTags.forEach((at: any) => {
          const currentCount = tagCountsMap.get(at.tag_id) || 0
          tagCountsMap.set(at.tag_id, currentCount + 1)
        })
      }
    }

    // Add asset counts to tags
    const tagsWithCounts = tagsData.map((tag) => ({
      ...tag,
      asset_count: tagCountsMap.get(tag.id) || 0,
    }))

    setTags(tagsWithCounts)
    setFilteredTags(tagsWithCounts)
    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...tags]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((tag) =>
        tag.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply tag type filter
    if (tagTypeFilter !== "all") {
      filtered = filtered.filter((tag) => tag.tag_type === tagTypeFilter)
    }

    setFilteredTags(filtered)
  }


  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#DF475C] border-t-transparent" />
            <p className="text-gray-600">Loading tags...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Tagging</h1>
        <Link href="/tagging/create">
          <Button className="bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">
            <Plus className="mr-2 h-4 w-4" />
            Create new tag
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search tag"
            className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tagTypeFilter} onValueChange={setTagTypeFilter} className="mb-6">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All Tags</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="visual_style">Visual style</TabsTrigger>
          <TabsTrigger value="file_type">File type</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tags Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tag</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tag type</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created by</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Assets</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredTags?.map((tag) => (
              <tr key={tag.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{tag.label}</td>
                <td className="px-6 py-4 text-sm capitalize text-gray-600">{tag.tag_type.replace("_", " ")}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {tag.users?.full_name || new Date(tag.created_at).toLocaleDateString("en-GB")}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{tag.asset_count || 0}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/tagging/${tag.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4 text-gray-600" />
                      </Button>
                    </Link>
                    {!tag.is_system && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            ←
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-gray-100">
            1
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-transparent">
            2
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-transparent">
            3
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            →
          </Button>
        </div>
      </div>
    </div>
  )
}
