"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Settings, Pencil, Plus, Search, Trash2, Building } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"

interface Client {
  id: string
  name: string
  slug: string
  domain: string | null
  status: string
  primary_color: string
  secondary_color: string
  storage_limit_mb: number
  created_at: string
  user_count?: number
  asset_count?: number
  storage_used_bytes: number
  storage_percentage?: number
}

type ClientData = Omit<Client, 'user_count' | 'asset_count' | 'storage_percentage'>

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [clients, statusFilter, searchQuery])

  const loadClients = async () => {
    const supabase = supabaseRef.current

    // Authentication and authorization is already handled by system-admin layout
    // No need to check user authentication or roles here

    // TEMP: Fetch ALL clients to debug BHJ issue
    console.log('[CLIENTS] Starting to fetch ALL clients (debugging)...')
    const { data: allClientsData, error: allError } = await supabase
      .from("clients")
      .select(`
        id,
        name,
        slug,
        domain,
        status,
        primary_color,
        secondary_color,
        storage_limit_mb,
        created_at,
        storage_used_bytes
      `)
      .order("name", { ascending: true })

    console.log('[CLIENTS] ALL clients result:', {
      allClientsData,
      allError,
      count: allClientsData?.length,
      clientNames: allClientsData?.map((c: any) => `${c.name} (${c.status})`)
    })

    // Try to fetch BHJ specifically
    const { data: bhjClient, error: bhjError } = await supabase
      .from("clients")
      .select("*")
      .eq("slug", "bhj")
      .single()

    console.log('[CLIENTS] BHJ specific query:', { bhjClient, bhjError })

    // Then fetch only active clients as normal
    const { data: clientsData, error } = await supabase
      .from("clients")
      .select(`
        id,
        name,
        slug,
        domain,
        status,
        primary_color,
        secondary_color,
        storage_limit_mb,
        created_at,
        storage_used_bytes
      `)
      .eq("status", "active")
      .order("name", { ascending: true })

    console.log('[CLIENTS] Query result:', {
      clientsData,
      error,
      count: clientsData?.length,
      clientNames: clientsData?.map((c: any) => c.name)
    })

    if (error) {
      console.error("Error loading clients:", error)
      setClients([])
      setFilteredClients([])
      setIsLoading(false)
      return
    }

    // Get asset and user counts for each client
    const clientsWithStats = await Promise.all(
      (clientsData || []).map(async (client: ClientData) => {
        const [assetResult, userResult] = await Promise.all([
          supabase.from("assets").select("id", { count: "exact" }).eq("client_id", client.id).eq("status", "active"),
          supabase.from("client_users").select("id", { count: "exact" }).eq("client_id", client.id).eq("status", "active")
        ])

        return {
          ...client,
          asset_count: assetResult.count || 0,
          user_count: userResult.count || 0,
          storage_percentage: client.storage_limit_mb > 0
            ? Math.round((client.storage_used_bytes / (client.storage_limit_mb * 1024 * 1024)) * 100)
            : 0
        } as Client
      })
    )

    setClients(clientsWithStats)
    setFilteredClients(clientsWithStats)
    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...clients]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((client) => client.status === statusFilter)
    }

    setFilteredClients(filtered)
  }

  const handleNavigateToClient = async (clientSlug: string) => {
    console.log('[ADMIN-NAV] Starting navigation to client:', clientSlug)

    const supabase = createClient()
    console.log('[ADMIN-NAV] Checking session...')

    const { data: { session }, error } = await supabase.auth.getSession()
    console.log('[ADMIN-NAV] Session result:', {
      hasSession: !!session,
      userId: session?.user?.id,
      error: error?.message
    })

    if (!session) {
      console.log('[ADMIN-NAV] No session, redirecting to login')
      window.location.href = '/login'
      return
    }

    // Byg URL med short-lived auth data (30 sekunder)
    const isDevelopment = process.env.NODE_ENV === 'development'
    const port = window.location.port || '3000'

    const targetUrl = isDevelopment
      ? `http://${clientSlug}.localhost:${port}/dashboard`
      : `https://${clientSlug}.brandassets.space/dashboard`

    // Tilføj session data som URL params (30 sekunders levetid)
    const params = new URLSearchParams({
      uid: session.user.id,
      exp: (Date.now() + 30000).toString() // 30 sekunder
    })

    const finalUrl = `${targetUrl}?${params}`
    console.log('[ADMIN-NAV] Navigating to:', finalUrl)

    window.location.href = finalUrl
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <ListPageHeaderSkeleton showCreateButton={true} />
        <SearchSkeleton />
        <TabsSkeleton count={3} />
        <TableSkeleton rows={8} columns={4} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <Link href="/system-admin/clients/create">
          <Button className="bg-black hover:bg-gray-800 text-white rounded-[25px]">
            <Plus className="mr-2 h-4 w-4" />
            Create new client
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search client"
            className="pl-10 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All clients</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
          <TabsTrigger value="deactivated">Deactivated</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Clients Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Client</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Users</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Storage</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredClients?.map((client) => {
              const storageUsedGB = (client.storage_used_bytes / 1024 / 1024 / 1024).toFixed(0)
              const storageLimitGB = (client.storage_limit_mb / 1024).toFixed(0)
              const storagePercentage = client.storage_percentage || 0

              return (
                <tr key={client.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-600"
                      >
                        <Building className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{client.user_count || 0} users</td>
                  <td className="px-6 py-4">
                    <div className="mb-1 text-sm font-medium text-gray-900">
                      {storageUsedGB} GB / {storageLimitGB} GB
                    </div>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-black transition-all"
                        style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={client.status === "active" ? "default" : "secondary"}
                      className={
                        client.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {client.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-[25px] bg-black text-white hover:bg-gray-800"
                        onClick={() => handleNavigateToClient(client.slug)}
                      >
                        →
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            ←
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 bg-transparent">
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

      {clients?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Settings className="mb-4 h-8 w-8 text-gray-400" />
          <p className="text-gray-600">Ready to set up your first client</p>
          <Link href="/system-admin/clients/create">
            <Button className="mt-4 bg-black hover:bg-gray-800 text-white rounded-[25px]">Create your first client</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

