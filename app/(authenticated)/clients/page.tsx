"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Building, Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

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
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#dc3545] border-t-transparent" />
            <p className="text-gray-600">Loading clients...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <Link href="/clients/create">
          <Button className="bg-[#dc3545] hover:bg-[#c82333]">
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

      <div className="mb-6 flex gap-2">
        <Button
          variant={statusFilter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          All clients
        </Button>
        <Button
          variant={statusFilter === "active" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setStatusFilter("active")}
        >
          Active
        </Button>
        <Button
          variant={statusFilter === "inactive" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setStatusFilter("inactive")}
        >
          Inactive
        </Button>
        <Button
          variant={statusFilter === "deactivated" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setStatusFilter("deactivated")}
        >
          Deactivated
        </Button>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="grid grid-cols-[2fr,1fr,1.5fr,1fr,auto] gap-4 border-b px-6 py-4 text-sm font-medium text-gray-700">
          <div>Client</div>
          <div>Users</div>
          <div>Storage</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {filteredClients?.map((client) => {
          const storageUsedGB = (client.storage_used_bytes / 1024 / 1024 / 1024).toFixed(0)
          const storageLimitGB = (client.storage_limit_mb / 1024).toFixed(0)
          const storagePercentage = client.storage_percentage || 0

          return (
            <div
              key={client.id}
              className="grid grid-cols-[2fr,1fr,1.5fr,1fr,auto] items-center gap-4 border-b px-6 py-4 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: client.primary_color || "#dc3545" }}
                >
                  <Building className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{client.name}</div>
                  <div className="text-sm text-gray-500">{client.slug}</div>
                </div>
              </div>

              <div className="text-sm text-gray-900">{client.user_count || 0} users</div>

              <div>
                <div className="mb-1 text-sm font-medium text-gray-900">
                  {storageUsedGB} GB / {storageLimitGB} GB
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#dc3545] transition-all"
                    style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <Badge
                  variant={client.status === "active" ? "default" : "secondary"}
                  className={
                    client.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {client.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
                <Link href={`/clients/${client.id}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-[#dc3545] text-white hover:bg-[#c82333]"
                  >
                    →
                  </Button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {clients?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Building className="mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600">No clients found</p>
          <Link href="/clients/create">
            <Button className="mt-4 bg-[#dc3545] hover:bg-[#c82333]">Create your first client</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
