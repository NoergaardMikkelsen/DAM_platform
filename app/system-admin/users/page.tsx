"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Plus, Search, Trash2, Shield, Users, Building } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"

interface SystemUser {
  id: string
  full_name: string | null
  email: string
  created_at: string
  is_superadmin: boolean
  client_count: number
  last_active?: string
}

interface Client {
  id: string
  name: string
  slug: string
}

export default function SystemUsersPage() {
  const [allUsers, setAllUsers] = useState<SystemUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<SystemUser[]>([])
  const [userTypeFilter, setUserTypeFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createUserLoading, setCreateUserLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'admin' // default to admin, can be changed to superadmin
  })
  const [createUserError, setCreateUserError] = useState<string | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadUsers()
    loadClients()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allUsers, userTypeFilter, searchQuery])

  const loadUsers = async () => {
    const supabase = supabaseRef.current

    // Authentication and authorization is already handled by system-admin layout
    // No need to check user authentication or roles here

    // Get all users with their system admin status and client associations
    const { data: users, error } = await supabase
      .from("users")
      .select(`
        id,
        full_name,
        email,
        created_at
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading users:", error)
      setIsLoading(false)
      return
    }

    // Get superadmin status for each user (users with superadmin role in any client)
    const { data: superadmins } = await supabase
      .from("client_users")
      .select(`
        user_id,
        roles!inner(key)
      `)
      .eq("status", "active")
      .eq("roles.key", "superadmin")

    const superadminIds = new Set(superadmins?.map((sa: { user_id: string }) => sa.user_id) || [])

    // Get client user counts for each user
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select(`
        user_id,
        client_id,
        clients (
          name
        )
      `)
      .eq("status", "active")

    // Count clients per user
    const clientCountMap = new Map<string, number>()
    clientUsers?.forEach((cu: any) => {
      const count = clientCountMap.get(cu.user_id) || 0
      clientCountMap.set(cu.user_id, count + 1)
    })

    // Combine the data
    const usersWithDetails: SystemUser[] = users?.map((user: { id: string; full_name: string | null; email: string; created_at: string }) => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      created_at: user.created_at,
      is_superadmin: superadminIds.has(user.id),
      client_count: clientCountMap.get(user.id) || 0
    })) || []

    setAllUsers(usersWithDetails)
    setFilteredUsers(usersWithDetails)
    setIsLoading(false)
  }

  const loadClients = async () => {
    const supabase = supabaseRef.current

    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name, slug")
      .eq("status", "active")
      .order("name")

    if (error) {
      console.error("Error loading clients:", error)
      return
    }

    setClients(clients || [])
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = supabaseRef.current

    setCreateUserLoading(true)
    setCreateUserError(null)

    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createUserForm.email,
        password: createUserForm.password,
        options: {
          data: {
            full_name: createUserForm.fullName,
          },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        // Get the role ID for selected role
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('key', createUserForm.role)
          .single()

        if (roleError) throw roleError

        // Create client_users entries for selected clients
        const clientUserInserts = selectedClients.map(clientId => ({
          user_id: authData.user.id,
          client_id: clientId,
          role_id: roleData.id,
          status: 'active'
        }))

        if (clientUserInserts.length > 0) {
          const { error: clientUserError } = await supabase
            .from('client_users')
            .insert(clientUserInserts)

          if (clientUserError) throw clientUserError
        }
      }

      // Reset form and close modal
      setCreateUserForm({
        email: '',
        password: '',
        fullName: '',
        role: 'admin'
      })
      setSelectedClients([])
      setIsCreateModalOpen(false)

      // Reload users list
      loadUsers()

    } catch (error: any) {
      setCreateUserError(error.message)
    } finally {
      setCreateUserLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allUsers]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((user) =>
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply user type filter
    if (userTypeFilter !== "all") {
      if (userTypeFilter === "superadmin") {
        filtered = filtered.filter((user) => user.is_superadmin)
      } else if (userTypeFilter === "client-users") {
        filtered = filtered.filter((user) => !user.is_superadmin && user.client_count > 0)
      } else if (userTypeFilter === "no-clients") {
        filtered = filtered.filter((user) => !user.is_superadmin && user.client_count === 0)
      }
    }

    setFilteredUsers(filtered)
  }

  // Note: Superadmin status is now managed via client_users table
  // To grant superadmin access, add a client_users entry with superadmin role_id
  // This UI no longer provides direct toggle functionality
  // Superadmin management should be done through client management interface

  if (isLoading) {
    return (
      <div className="p-8">
        <ListPageHeaderSkeleton showCreateButton={true} />
        <SearchSkeleton />
        <TabsSkeleton count={4} />
        <TableSkeleton rows={8} columns={5} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">System Users</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white rounded-[25px]">
              <Plus className="mr-2 h-4 w-4" />
              Invite new user
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Create a new user account and assign them to specific clients.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    required
                    value={createUserForm.fullName}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">System Role *</Label>
                  <Select
                    value={createUserForm.role}
                    onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Assign to Clients</Label>
                <div className="grid gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`client-${client.id}`}
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedClients(prev => [...prev, client.id])
                          } else {
                            setSelectedClients(prev => prev.filter(id => id !== client.id))
                          }
                        }}
                      />
                      <Label htmlFor={`client-${client.id}`} className="text-sm">
                        {client.name} ({client.slug})
                      </Label>
                    </div>
                  ))}
                </div>
                {clients.length === 0 && (
                  <p className="text-sm text-gray-500">No active clients found</p>
                )}
              </div>

              {createUserError && (
                <p className="text-sm text-red-500">{createUserError}</p>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-black hover:bg-gray-800 text-white"
                  disabled={createUserLoading}
                >
                  {createUserLoading ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search users"
            className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={userTypeFilter} onValueChange={setUserTypeFilter} className="mb-6">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All users</TabsTrigger>
          <TabsTrigger value="superadmin">Superadmins</TabsTrigger>
          <TabsTrigger value="client-users">Client Users</TabsTrigger>
          <TabsTrigger value="no-clients">No Clients</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Users Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Role</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Clients</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers?.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">{user.full_name || "N/A"}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {user.is_superadmin ? (
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Superadmin
                      </Badge>
                    ) : user.client_count > 0 ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <Users className="w-3 h-3 mr-1" />
                        Client User
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                        <Users className="w-3 h-3 mr-1" />
                        No Access
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Building className="w-4 h-4" />
                    {user.client_count}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
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
    </div>
  )
}

