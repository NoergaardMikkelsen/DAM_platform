"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Building, Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
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
  user_count: number
  asset_count: number
  storage_used_bytes: number
  storage_percentage?: number
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [clients, statusFilter, searchQuery])

  const loadClients = async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Check if user is superadmin
    const { data: userRole } = await supabase
      .from("client_users")
      .select(`roles(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    const role = userRole?.roles?.key

    if (role !== "superadmin") {
      router.push("/dashboard")
      return
    }

    const { data: clientsData } = await supabase.from("client_storage_stats").select("*").order("name", { ascending: true })

    setClients(clientsData || [])
    setFilteredClients(clientsData || [])
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
        <Link href="/clients/create">
          <Button className="bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">
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
            className="pl-10"
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
                        className="h-full rounded-full bg-[#DF475C] transition-all"
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
                      <Link href={`/clients/${client.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-[25px] bg-[#DF475C] text-white hover:bg-[#C82333]"
                        >
                          →
                        </Button>
                      </Link>
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
          <Building className="mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600">No clients found</p>
          <Link href="/clients/create">
            <Button className="mt-4 bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">Create your first client</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

