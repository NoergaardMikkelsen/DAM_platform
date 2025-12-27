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
  highest_role: string | null  // 'superadmin' | 'admin' | 'user' | null
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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    role: 'admin'
  })
  const [editSelectedClients, setEditSelectedClients] = useState<string[]>([])
  const [editUserLoading, setEditUserLoading] = useState(false)
  const [editUserError, setEditUserError] = useState<string | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadUsers()
    loadClients()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allUsers, userTypeFilter, searchQuery])

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

    // Get all user roles and client associations
    const { data: userRoles } = await supabase
      .from("client_users")
      .select(`
        user_id,
        roles!inner(key),
        client_id,
        clients (
          name
        )
      `)
      .eq("status", "active")

    // Group roles by user and find highest role
    const userRoleMap = new Map<string, { highest_role: string, client_count: number, is_superadmin: boolean }>()
    userRoles?.forEach((ur: any) => {
      const userId = ur.user_id
      const roleKey = ur.roles.key

      if (!userRoleMap.has(userId)) {
        userRoleMap.set(userId, {
          highest_role: roleKey,
          client_count: 1,
          is_superadmin: roleKey === 'superadmin'
        })
      } else {
        const existing = userRoleMap.get(userId)!
        existing.client_count += 1

        // Update highest role (superadmin > admin > user)
        if (roleKey === 'superadmin' ||
            (roleKey === 'admin' && existing.highest_role !== 'superadmin') ||
            (roleKey === 'user' && existing.highest_role === null)) {
          existing.highest_role = roleKey
          existing.is_superadmin = roleKey === 'superadmin'
        }
      }
    })

    // Combine the data
    const usersWithDetails: SystemUser[] = users?.map((user: { id: string; full_name: string | null; email: string; created_at: string }) => {
      const userRoleData = userRoleMap.get(user.id) || { highest_role: null, client_count: 0, is_superadmin: false }
      return {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
        is_superadmin: userRoleData.is_superadmin,
        client_count: userRoleData.client_count,
        highest_role: userRoleData.highest_role
      }
    }) || []

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

  const handleEditUser = async (user: SystemUser) => {
    const supabase = supabaseRef.current

    // Get user's current client associations
    const { data: userClientData, error } = await supabase
      .from("client_users")
      .select(`
        client_id,
        role_id,
        roles(key)
      `)
      .eq("user_id", user.id)
      .eq("status", "active")

    if (error) {
      console.error("Error loading user client data:", error)
      return
    }

    // Find the highest role for the default selection
    let highestRole = 'admin'
    const clientIds: string[] = []

    userClientData?.forEach((ucd: any) => {
      clientIds.push(ucd.client_id)
      if (ucd.roles.key === 'superadmin') {
        highestRole = 'superadmin'
      } else if (ucd.roles.key === 'admin' && highestRole !== 'superadmin') {
        highestRole = 'admin'
      }
    })

    setEditingUser(user)
    setEditUserForm({
      fullName: user.full_name || '',
      email: user.email,
      role: highestRole
    })
    setEditSelectedClients(clientIds)
    setIsEditModalOpen(true)
  }

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const supabase = supabaseRef.current
    setEditUserLoading(true)
    setEditUserError(null)

    try {
      // Update user profile if name changed
      if (editUserForm.fullName !== editingUser.full_name) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ full_name: editUserForm.fullName })
          .eq('id', editingUser.id)

        if (updateError) throw updateError
      }

      // Get the role ID for selected role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('key', editUserForm.role)
        .single()

      if (roleError) throw roleError

      // Get current client associations for this user
      const { data: currentAssociations, error: currentError } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', editingUser.id)
        .eq('status', 'active')

      if (currentError) throw currentError

      const currentClientIds = currentAssociations?.map((ca: any) => ca.client_id) || []

      // Clients to remove (in current but not in selected)
      const clientsToRemove = currentClientIds.filter((id: string) => !editSelectedClients.includes(id))

      // Clients to add (in selected but not in current)
      const clientsToAdd = editSelectedClients.filter(id => !currentClientIds.includes(id))

      // Remove associations for clients no longer selected
      if (clientsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('client_users')
          .update({ status: 'inactive' })
          .eq('user_id', editingUser.id)
          .in('client_id', clientsToRemove)

        if (removeError) throw removeError
      }

      // Add new associations
      if (clientsToAdd.length > 0) {
        const newAssociations = clientsToAdd.map(clientId => ({
          user_id: editingUser.id,
          client_id: clientId,
          role_id: roleData.id,
          status: 'active'
        }))

        const { error: addError } = await supabase
          .from('client_users')
          .insert(newAssociations)

        if (addError) throw addError
      }

      // Update existing associations (change role if needed)
      if (editSelectedClients.length > 0) {
        const { error: updateError } = await supabase
          .from('client_users')
          .update({ role_id: roleData.id })
          .eq('user_id', editingUser.id)
          .in('client_id', editSelectedClients)
          .eq('status', 'active')

        if (updateError) throw updateError
      }

      // Reset form and close modal
      setIsEditModalOpen(false)
      setEditingUser(null)
      setEditUserForm({
        fullName: '',
        email: '',
        role: 'admin'
      })
      setEditSelectedClients([])

      // Reload users list
      loadUsers()

    } catch (error: any) {
      setEditUserError(error.message)
    } finally {
      setEditUserLoading(false)
    }
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
    // Reset to first page when filters change
    setCurrentPage(1)
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

        {/* Edit User Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and client access for {editingUser?.full_name || editingUser?.email}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditUserSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editFullName">Full Name</Label>
                  <Input
                    id="editFullName"
                    required
                    value={editUserForm.fullName}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    required
                    value={editUserForm.email}
                    disabled
                    className="bg-gray-50"
                    title="Email cannot be changed"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editRole">System Role</Label>
                  <Select
                    value={editUserForm.role}
                    onValueChange={(value) => setEditUserForm(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
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
                        id={`edit-client-${client.id}`}
                        checked={editSelectedClients.includes(client.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditSelectedClients(prev => [...prev, client.id])
                          } else {
                            setEditSelectedClients(prev => prev.filter(id => id !== client.id))
                          }
                        }}
                      />
                      <Label htmlFor={`edit-client-${client.id}`} className="text-sm">
                        {client.name} ({client.slug})
                      </Label>
                    </div>
                  ))}
                </div>
                {clients.length === 0 && (
                  <p className="text-sm text-gray-500">No active clients found</p>
                )}
              </div>

              {editUserError && (
                <p className="text-sm text-red-500">{editUserError}</p>
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
                  disabled={editUserLoading}
                >
                  {editUserLoading ? "Updating..." : "Update User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-6 flex justify-end">
        <div className="relative max-w-[400px] w-full">
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
      <Tabs value={userTypeFilter} onValueChange={setUserTypeFilter} className="mb-0">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All users</TabsTrigger>
          <TabsTrigger value="superadmin">Superadmins</TabsTrigger>
          <TabsTrigger value="client-users">Client Users</TabsTrigger>
          <TabsTrigger value="no-clients">No Clients</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Users Table */}
      <div className="overflow-hidden" style={{ borderRadius: '0 20px 20px 20px', background: '#FFF' }}>
        <table className="w-full">
          <thead>
            <tr className="rounded-[20px] bg-[#F9F9F9]">
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900 first:pl-6">Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Role</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Clients</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900 last:pr-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-b-0">
                <td className="px-6 py-4 text-sm text-gray-900">{user.full_name || "N/A"}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {user.is_superadmin ? (
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Superadmin
                      </Badge>
                    ) : user.highest_role === 'admin' ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <Users className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    ) : user.highest_role === 'user' ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <Users className="w-3 h-3 mr-1" />
                        User
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditUser(user)}
                    >
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
      </div>

      {/* Pagination - Fixed in bottom right corner */}
      {filteredUsers.length > 0 && (() => {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
        
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
    </div>
  )
}

