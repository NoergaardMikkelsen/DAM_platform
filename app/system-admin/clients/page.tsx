"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Settings, Pencil, Trash2, Building } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { usePagination } from "@/hooks/use-pagination"
import { STORAGE_LIMITS, PAGINATION } from "@/lib/constants"
import { logError } from "@/lib/utils/logger"
import { useSearchFilter } from "@/hooks/use-search-filter"
import { TablePage, TableColumn } from "@/components/table-page"
import { EmptyState } from "@/components/empty-state"

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

interface AssetWithFileSize {
  file_size: number | null
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  // Use search filter hook
  const {
    searchQuery,
    setSearchQuery,
    filteredItems: searchFilteredClients,
  } = useSearchFilter({
    items: clients,
    searchFields: (client) => [client.name, client.slug],
  })

  // Apply status filter on top of search filter
  const filteredClients = statusFilter === "all"
    ? searchFilteredClients
    : searchFilteredClients.filter((client) => client.status === statusFilter)

  // Use pagination hook
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems: paginatedClients,
    goToPage,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
  } = usePagination(filteredClients, {
    calculateItemsPerPage: true,
    fixedHeight: PAGINATION.DEFAULT_FIXED_HEIGHT,
    rowHeight: PAGINATION.DEFAULT_ROW_HEIGHT,
    minItemsPerPage: PAGINATION.MIN_ITEMS_PER_PAGE,
  })

  useEffect(() => {
    loadClients()
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
      logError("Error loading clients:", error)
      setClients([])
      setFilteredClients([])
      setIsLoading(false)
      return
    }

    // Get asset and user counts and calculate actual storage used for each client
    const clientsWithStats = await Promise.all(
      (clientsData || []).map(async (client: ClientData) => {
        const [assetResult, userResult] = await Promise.all([
          supabase.from("assets").select("id", { count: "exact" }).eq("client_id", client.id).eq("status", "active"),
          supabase.from("client_users").select("id", { count: "exact" }).eq("client_id", client.id).eq("status", "active")
        ])

        // Get actual storage usage from Storage API
        let actualStorageUsedBytes = 0
        try {
          const storageResponse = await fetch(`/api/storage-usage/${client.id}`)
          if (storageResponse.ok) {
            const storageData = await storageResponse.json()
            actualStorageUsedBytes = storageData.total_bytes || 0
          } else {
            // Fallback to DB calculation if API fails
            const { data: storageResult } = await supabase.from("assets").select("file_size").eq("client_id", client.id).eq("status", "active")
            actualStorageUsedBytes = storageResult?.reduce((total: number, asset: AssetWithFileSize) => total + (asset.file_size || 0), 0) || 0
          }
        } catch (error) {
          console.error(`Error fetching storage for client ${client.id}:`, error)
          // Fallback to DB calculation if API fails
          const { data: storageResult } = await supabase.from("assets").select("file_size").eq("client_id", client.id).eq("status", "active")
          actualStorageUsedBytes = storageResult?.reduce((total: number, asset: AssetWithFileSize) => total + (asset.file_size || 0), 0) || 0
        }

        return {
          ...client,
          asset_count: assetResult.count || 0,
          user_count: userResult.count || 0,
          storage_used_bytes: actualStorageUsedBytes, // Override with actual calculation from Storage API
          storage_percentage: client.storage_limit_mb > 0
            ? Math.round((actualStorageUsedBytes / (client.storage_limit_mb * STORAGE_LIMITS.BYTES_PER_MB)) * 1000) / 10 // Round to 1 decimal place
            : 0
        } as Client
      })
    )

    setClients(clientsWithStats)
    setIsLoading(false)
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

    } catch (error: unknown) {
      setEditClientError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setEditClientLoading(false)
    }
  }

  const handleDeleteClient = async () => {
    if (!clientToDelete) return

    const supabase = supabaseRef.current
    setIsDeleting(true)

    try {
      // Delete the client (cascade will handle related records)
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientToDelete.id)

      if (error) throw error

      // Close dialog and reset state
      setIsDeleteDialogOpen(false)
      setClientToDelete(null)

      // Reload clients list
      loadClients()
    } catch (error: unknown) {
      setEditClientError(error instanceof Error ? error.message : "Failed to delete client")
      setIsDeleting(false)
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

  const columns: TableColumn<Client>[] = [
    {
      header: "Client",
      render: (client) => (
                    <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden">
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
      ),
    },
    {
      header: "Users",
      render: (client) => `${client.user_count || 0} users`,
    },
    {
      header: "Storage",
      render: (client) => {
        const storageUsedBytes = client.storage_used_bytes || 0
        const storageUsedGB = storageUsedBytes / STORAGE_LIMITS.BYTES_PER_GB
        const storageUsedMB = storageUsedBytes / STORAGE_LIMITS.BYTES_PER_MB
        const storageLimitGB = Math.round((client.storage_limit_mb / 1024) * 10) / 10 || STORAGE_LIMITS.DEFAULT_GB
        const storagePercentage = client.storage_percentage || 0
        
        // Show in MB if under 1 GB, otherwise show in GB with 1 decimal
        const storageUsedDisplay = storageUsedGB < 1 
          ? `${Math.round(storageUsedMB)} MB`
          : `${storageUsedGB.toFixed(1).replace('.', ',')} GB`
        
        return (
          <div>
                    <div className="mb-1 text-sm font-medium text-gray-900">
                      {storageUsedDisplay} af {storageLimitGB.toFixed(1).replace('.', ',')} GB ({storagePercentage.toFixed(1).replace('.', ',')}%)
                    </div>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-black transition-all"
                        style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                      />
                    </div>
          </div>
        )
      },
    },
    {
      header: "Status",
      render: (client) => (
                    <Badge
                      variant={client.status === "active" ? "default" : "secondary"}
                      className={
                        client.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {client.status}
                    </Badge>
      ),
    },
    {
      header: "Actions",
      align: "right",
      render: (client) => (
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setClientToDelete(client)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black text-white hover:bg-gray-800 hover:text-white [&_svg]:opacity-100 [&_svg]:hover:opacity-100"
                        onClick={() => handleNavigateToClient(client.slug)}
                      >
                        <svg
                          viewBox="0 8 25 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          preserveAspectRatio="xMidYMid"
                          className="shrink-0 opacity-100"
                          style={{
                            width: '18px',
                            height: '16px',
                          }}
                        >
                          <path
                            d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </Button>
                    </div>
      ),
    },
  ]

  const loadingSkeleton = (
    <>
      <ListPageHeaderSkeleton showCreateButton={true} />
      <SearchSkeleton />
      <TabsSkeleton count={4} />
      <TableSkeleton rows={8} columns={5} />
    </>
  )

  return (
    <TablePage
      title="Clients"
      createButton={{
        label: "Create new client",
        href: "/system-admin/clients/create",
        className: "bg-black hover:bg-gray-800 text-white",
      }}
      search={{
        placeholder: "Search client",
        value: searchQuery,
        onChange: setSearchQuery,
        position: "below",
      }}
      tabs={{
        value: statusFilter,
        onChange: setStatusFilter,
        items: [
          { value: "all", label: "All clients" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "deactivated", label: "Deactivated" },
        ],
      }}
      columns={columns}
      data={filteredClients}
      getRowKey={(client) => client.id}
      pagination={{
        currentPage,
        itemsPerPage,
        totalPages,
        paginatedItems: paginatedClients,
        goToPage,
        nextPage,
        prevPage,
        isFirstPage,
        isLastPage,
      }}
      emptyState={
        filteredClients.length === 0 && clients.length === 0
          ? {
              icon: Settings,
              title: "Ready to set up your first client",
              action: {
                label: "Create your first client",
                onClick: () => router.push("/system-admin/clients/create"),
              },
            }
          : filteredClients.length === 0
          ? {
              icon: Settings,
              title: "No clients found",
              description: "Try adjusting your filters or search query.",
            }
          : undefined
      }
      isLoading={isLoading}
      loadingSkeleton={loadingSkeleton}
    >
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
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, storage_limit_mb: parseInt(e.target.value) * (STORAGE_LIMITS.BYTES_PER_GB / STORAGE_LIMITS.BYTES_PER_MB) }))}
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
                variant="secondary"
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

      {/* Delete Client Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete client "{clientToDelete?.name}"? 
              This action cannot be undone and will permanently remove all associated data including users, assets, and storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TablePage>
  )
}

