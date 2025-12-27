"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Settings, Pencil, Plus, Search, Trash2, Building } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  logo_collapsed_url?: string
  logo_url?: string
  favicon_url?: string
}

type ClientData = Omit<Client, 'user_count' | 'asset_count' | 'storage_percentage'>

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editClientForm, setEditClientForm] = useState({
    name: '',
    primary_color: '',
    secondary_color: '',
    storage_limit_mb: 0
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoCollapsedFile, setLogoCollapsedFile] = useState<File | null>(null)
  const [logoCollapsedPreview, setLogoCollapsedPreview] = useState<string | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)
  const [editClientLoading, setEditClientLoading] = useState(false)
  const [editClientError, setEditClientError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [clients, statusFilter, searchQuery])

  // Calculate items per page based on viewport height
  useEffect(() => {
    const calculateItemsPerPage = () => {
      // Estimate heights:
      // - Header: ~80px
      // - Search: ~50px
      // - Tabs: ~50px
      // - Table header: ~60px
      // - Padding (p-8): ~64px (top + bottom)
      // - Pagination: ~60px
      // - Some margin: ~40px
      const fixedHeight = 80 + 50 + 50 + 60 + 64 + 60 + 40
      const availableHeight = window.innerHeight - fixedHeight
      const rowHeight = 60 // Approximate row height (py-4 = 16px top + 16px bottom + text ~28px)
      const calculatedItems = Math.max(3, Math.floor(availableHeight / rowHeight))
      setItemsPerPage(calculatedItems)
    }

    calculateItemsPerPage()
    window.addEventListener('resize', calculateItemsPerPage)
    return () => window.removeEventListener('resize', calculateItemsPerPage)
  }, [])

  const loadClients = async () => {
    const supabase = supabaseRef.current

    // Authentication and authorization is already handled by system-admin layout
    // No need to check user authentication or roles here

    // Fetch active clients
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
        storage_used_bytes,
        logo_collapsed_url,
        logo_url,
        favicon_url
      `)
      .eq("status", "active")
      .order("name", { ascending: true })


    if (error) {
      console.error("Error loading clients:", error)
      setClients([])
      setFilteredClients([])
      setIsLoading(false)
      return
    }

    // Get asset and user counts and calculate actual storage used for each client
    const clientsWithStats = await Promise.all(
      (clientsData || []).map(async (client: ClientData) => {
        const [assetResult, userResult, storageResult] = await Promise.all([
          supabase.from("assets").select("id", { count: "exact" }).eq("client_id", client.id).eq("status", "active"),
          supabase.from("client_users").select("id", { count: "exact" }).eq("client_id", client.id).eq("status", "active"),
          supabase.from("assets").select("file_size").eq("client_id", client.id).eq("status", "active")
        ])

        // Calculate actual storage used by summing all asset file sizes
        const actualStorageUsedBytes = storageResult.data?.reduce((total: number, asset: any) => total + (asset.file_size || 0), 0) || 0

        return {
          ...client,
          asset_count: assetResult.count || 0,
          user_count: userResult.count || 0,
          storage_used_bytes: actualStorageUsedBytes, // Override with actual calculation
          storage_percentage: client.storage_limit_mb > 0
            ? Math.round((actualStorageUsedBytes / (client.storage_limit_mb * 1024 * 1024)) * 100)
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
    // Reset to first page when filters change
    setCurrentPage(1)
  }

  const handleEditClient = (client: Client) => {
    // Reset all state first
    setEditingClient(null)
    setLogoPreview(null)
    setLogoCollapsedPreview(null)
    setFaviconPreview(null)
    setLogoFile(null)
    setLogoCollapsedFile(null)
    setFaviconFile(null)

    // Then set new values
    setTimeout(() => {
      setEditingClient(client)
      setEditClientForm({
        name: client.name,
        primary_color: client.primary_color,
        secondary_color: client.secondary_color,
        storage_limit_mb: client.storage_limit_mb
      })
      setLogoPreview(client.logo_url || null)
      setLogoCollapsedPreview(client.logo_collapsed_url || null)
      setFaviconPreview(client.favicon_url || null)
      setIsEditModalOpen(true)
    }, 10)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setLogoPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleLogoCollapsedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoCollapsedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setLogoCollapsedPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFaviconFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setFaviconPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(editingClient?.logo_url || null)
  }

  const removeLogoCollapsed = () => {
    setLogoCollapsedFile(null)
    setLogoCollapsedPreview(editingClient?.logo_collapsed_url || null)
  }

  const removeFavicon = () => {
    setFaviconFile(null)
    setFaviconPreview(editingClient?.favicon_url || null)
  }

  const handleEditClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient) return

    const supabase = supabaseRef.current
    setEditClientLoading(true)
    setEditClientError(null)

    try {
      let logoUrl = editingClient.logo_url
      let logoCollapsedUrl = editingClient.logo_collapsed_url
      let faviconUrl = editingClient.favicon_url

      // Upload new logo if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `client-logo-${editingClient.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(`client-logos/${fileName}`, logoFile)

        if (uploadError) throw uploadError

        logoUrl = supabase.storage.from('logos').getPublicUrl(`client-logos/${fileName}`).data.publicUrl

        // Delete old logo if it exists
        if (editingClient.logo_url) {
          const oldPath = editingClient.logo_url.split('/').pop()
          if (oldPath) {
            await supabase.storage.from('logos').remove([`client-logos/${oldPath}`])
          }
        }
      }

      // Upload new collapsed logo if provided
      if (logoCollapsedFile) {
        const fileExt = logoCollapsedFile.name.split('.').pop()
        const fileName = `client-logo-collapsed-${editingClient.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(`client-collapsed-logos/${fileName}`, logoCollapsedFile)

        if (uploadError) throw uploadError

        logoCollapsedUrl = supabase.storage.from('logos').getPublicUrl(`client-collapsed-logos/${fileName}`).data.publicUrl

        // Delete old collapsed logo if it exists
        if (editingClient.logo_collapsed_url) {
          const oldPath = editingClient.logo_collapsed_url.split('/').pop()
          if (oldPath) {
            await supabase.storage.from('logos').remove([`client-collapsed-logos/${oldPath}`])
          }
        }
      }

      // Upload new favicon if provided
      if (faviconFile) {
        const fileExt = faviconFile.name.split('.').pop()
        const fileName = `client-favicon-${editingClient.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(`client-favicons/${fileName}`, faviconFile)

        if (uploadError) throw uploadError

        faviconUrl = supabase.storage.from('logos').getPublicUrl(`client-favicons/${fileName}`).data.publicUrl

        // Delete old favicon if it exists
        if (editingClient.favicon_url) {
          const oldPath = editingClient.favicon_url.split('/').pop()
          if (oldPath) {
            await supabase.storage.from('logos').remove([`client-favicons/${oldPath}`])
          }
        }
      }

      // Update client record
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name: editClientForm.name,
          primary_color: editClientForm.primary_color,
          secondary_color: editClientForm.secondary_color,
          storage_limit_mb: editClientForm.storage_limit_mb,
          logo_url: logoUrl,
          logo_collapsed_url: logoCollapsedUrl,
          favicon_url: faviconUrl
        })
        .eq('id', editingClient.id)

      if (updateError) throw updateError

      // Reset form and close modal
      setIsEditModalOpen(false)
      setEditingClient(null)
      setEditClientForm({
        name: '',
        primary_color: '',
        secondary_color: '',
        storage_limit_mb: 0
      })
      setLogoFile(null)
      setLogoPreview(null)
      setLogoCollapsedFile(null)
      setLogoCollapsedPreview(null)
      setFaviconFile(null)
      setFaviconPreview(null)

      // Reload clients list
      loadClients()

    } catch (error: any) {
      setEditClientError(error.message)
    } finally {
      setEditClientLoading(false)
    }
  }

  const handleNavigateToClient = async (clientSlug: string) => {
    const supabase = createClient()

    const { data: { session }, error } = await supabase.auth.getSession()

    if (!session) {
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
      <div className="mb-6 flex justify-end">
        <div className="relative max-w-[400px] w-full">
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
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-0">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All clients</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
          <TabsTrigger value="deactivated">Deactivated</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Clients Table */}
      <div className="overflow-hidden" style={{ borderRadius: '0 20px 20px 20px', background: '#FFF' }}>
        <table className="w-full">
          <thead>
            <tr className="rounded-[20px] bg-[#F9F9F9]">
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900 first:pl-6">Client</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Users</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Storage</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900 last:pr-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((client) => {
              const storageUsedGB = Math.round(client.storage_used_bytes / 1024 / 1024 / 1024)
              const storageLimitGB = 10 // Fixed 10 GB limit per client
              const storagePercentage = client.storage_percentage || 0

              return (
                <tr key={client.id} className="hover:bg-gray-50/50 cursor-pointer border-b border-gray-100 last:border-b-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden"
                      >
                        {client.logo_collapsed_url ? (
                          <img
                            src={client.logo_collapsed_url}
                            alt={`${client.name} logo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-600">
                            <Building className="h-5 w-5 text-white" />
                          </div>
                        )}
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
                      {storageUsedGB} GB af {storageLimitGB} GB
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditClient(client)
                        }}
                      >
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
      </div>

      {/* Pagination - Fixed in bottom right corner */}
      {filteredClients.length > 0 && (() => {
        const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
        
        return (
          <div className="fixed bottom-8 right-8 flex items-center gap-4 z-10">
            <button
              className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <svg
                viewBox="0 8 25 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                style={{ transform: 'scaleX(-1)' }}
              >
                <path
                  d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                  stroke="black"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1 bg-[#E6E6E6] rounded-[30px] p-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  className={`flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === 1
                      ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                      : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  1
                </button>
                {totalPages > 2 && (
                  <>
                    {currentPage <= 2 ? (
                      <button
                        onClick={() => setCurrentPage(2)}
                        className={`flex items-center justify-center transition-all cursor-pointer ${
                          currentPage === 2
                            ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                            : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        2
                      </button>
                    ) : (
                      <>
                        {currentPage > 3 && (
                          <>
                            <span className="h-8 w-8 flex items-center justify-center text-gray-400">...</span>
                          </>
                        )}
                        <button
                          onClick={() => setCurrentPage(currentPage)}
                          className="h-9 w-9 rounded-full bg-white text-gray-900 flex items-center justify-center cursor-pointer"
                        >
                          {currentPage}
                        </button>
                      </>
                    )}
                    {totalPages > 3 && currentPage < totalPages && (
                      <>
                        {currentPage < totalPages - 1 && (
                          <span className="h-8 w-8 flex items-center justify-center text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className={`flex items-center justify-center transition-all cursor-pointer ${
                            currentPage === totalPages
                              ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                              : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-gray-900">
                1
              </div>
            )}
            <button
              className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
            >
              <svg
                viewBox="0 8 25 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
              >
                <path
                  d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                  stroke="black"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        )
      })()}

      {clients?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Settings className="mb-4 h-8 w-8 text-gray-400" />
          <p className="text-gray-600">Ready to set up your first client</p>
          <Link href="/system-admin/clients/create">
            <Button className="mt-4 bg-black hover:bg-gray-800 text-white rounded-[25px]">Create your first client</Button>
          </Link>
        </div>
      )}

      {/* Edit Client Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information, colors, and branding assets for {editingClient?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditClientSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editClientName">Client Name</Label>
                <Input
                  id="editClientName"
                  required
                  value={editClientForm.name}
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editPrimaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="editPrimaryColor"
                      type="color"
                      value={editClientForm.primary_color}
                      onChange={(e) => setEditClientForm(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-16 h-10"
                    />
                    <Input
                      value={editClientForm.primary_color}
                      onChange={(e) => setEditClientForm(prev => ({ ...prev, primary_color: e.target.value }))}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editSecondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="editSecondaryColor"
                      type="color"
                      value={editClientForm.secondary_color}
                      onChange={(e) => setEditClientForm(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="w-16 h-10"
                    />
                    <Input
                      value={editClientForm.secondary_color}
                      onChange={(e) => setEditClientForm(prev => ({ ...prev, secondary_color: e.target.value }))}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editStorageLimit">Storage Limit (GB)</Label>
                <Input
                  id="editStorageLimit"
                  type="number"
                  required
                  min="1"
                  value={editClientForm.storage_limit_mb / 1024}
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, storage_limit_mb: parseInt(e.target.value) * 1024 }))}
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Main Logo {logoPreview ? '(Current)' : '(None)'}</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Choose Logo
                  </label>
                  {logoPreview && (
                    <div className="flex items-center gap-2">
                      <img src={logoPreview} alt="Logo preview" className="h-8 w-auto max-w-32 object-contain" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLogo}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Collapsed Logo {logoCollapsedPreview ? '(Current)' : '(None)'}</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoCollapsedChange}
                    className="hidden"
                    id="logo-collapsed-upload"
                  />
                  <label
                    htmlFor="logo-collapsed-upload"
                    className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Choose Collapsed Logo
                  </label>
                  {logoCollapsedPreview && (
                    <div className="flex items-center gap-2">
                      <img src={logoCollapsedPreview} alt="Collapsed logo preview" className="h-8 w-8 rounded object-cover" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLogoCollapsed}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Favicon {faviconPreview ? '(Current)' : '(None)'}</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFaviconChange}
                    className="hidden"
                    id="favicon-upload"
                  />
                  <label
                    htmlFor="favicon-upload"
                    className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Choose Favicon
                  </label>
                  {faviconPreview && (
                    <div className="flex items-center gap-2">
                      <img src={faviconPreview} alt="Favicon preview" className="h-6 w-6 rounded object-cover" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFavicon}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {editClientError && (
              <p className="text-sm text-red-500">{editClientError}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-black hover:bg-gray-800 text-white"
                disabled={editClientLoading}
              >
                {editClientLoading ? "Updating..." : "Update Client"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

