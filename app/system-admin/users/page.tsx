"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { RoleBadge } from "@/components/role-badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Plus, Search, Trash2, Shield, Users, Building } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { usePagination } from "@/hooks/use-pagination"
import { PAGINATION, DEFAULT_ROLES } from "@/lib/constants"
import { formatDate } from "@/lib/utils/date"
import { PageHeader } from "@/components/page-header"
import { useSearchFilter } from "@/hooks/use-search-filter"
import { logError } from "@/lib/utils/logger"
import { EmptyState } from "@/components/empty-state"

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

interface UserRole {
  user_id: string
  roles: {
    key: string
  }
}

interface ClientAssociation {
  client_id: string
}

export default function SystemUsersPage() {
  const [allUsers, setAllUsers] = useState<SystemUser[]>([])
  const [userTypeFilter, setUserTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createUserLoading, setCreateUserLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: DEFAULT_ROLES.ADMIN // default to admin, can be changed to superadmin
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

  // Use search filter hook
  const {
    searchQuery,
    setSearchQuery,
    filteredItems: searchFilteredUsers,
  } = useSearchFilter({
    items: allUsers,
    searchFields: (user) => [
      user.full_name || "",
      user.email || "",
    ],
  })

  // Apply user type filter on top of search filter
  const filteredUsers = userTypeFilter === "all"
    ? searchFilteredUsers
    : userTypeFilter === "superadmin"
    ? searchFilteredUsers.filter((user) => user.is_superadmin)
    : userTypeFilter === "client-users"
    ? searchFilteredUsers.filter((user) => !user.is_superadmin && user.client_count > 0)
    : searchFilteredUsers.filter((user) => !user.is_superadmin && user.client_count === 0)

  // Use pagination hook
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems: paginatedUsers,
    goToPage,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
  } = usePagination(filteredUsers, {
    calculateItemsPerPage: true,
    fixedHeight: PAGINATION.DEFAULT_FIXED_HEIGHT,
    rowHeight: PAGINATION.DEFAULT_ROW_HEIGHT,
    minItemsPerPage: PAGINATION.MIN_ITEMS_PER_PAGE,
  })

  useEffect(() => {
    loadUsers()
    loadClients()
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
      logError("Error loading users:", error)
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
    userRoles?.forEach((ur: UserRole) => {
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
      logError("Error loading clients:", error)
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
      logError("Error loading user client data:", error)
      return
    }

    // Find the highest role for the default selection
    let highestRole = 'admin'
    const clientIds: string[] = []

    userClientData?.forEach((ucd: { client_id: string; roles: { key: string } }) => {
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

      const currentClientIds = currentAssociations?.map((ca: ClientAssociation) => ca.client_id) || []

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

    } catch (error: unknown) {
      setEditUserError(error instanceof Error ? error.message : "Unknown error")
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

    } catch (error: unknown) {
      setCreateUserError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setCreateUserLoading(false)
    }
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
      <PageHeader
        title="System Users"
        search={{
          placeholder: "Search users",
          value: searchQuery,
          onChange: setSearchQuery,
          position: "below",
        }}
      />
      <div className="mb-8 flex items-center justify-end">
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
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
                  <EmptyState
                    icon={Users}
                    title="No active clients found"
                    description="This user is not associated with any active clients."
                  />
                )}
              </div>

              {createUserError && (
                <p className="text-sm text-red-500">{createUserError}</p>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
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
                  <EmptyState
                    icon={Users}
                    title="No active clients found"
                    description="This user is not associated with any active clients."
                  />
                )}
              </div>

              {editUserError && (
                <p className="text-sm text-red-500">{editUserError}</p>
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
                  disabled={editUserLoading}
                >
                  {editUserLoading ? "Updating..." : "Update User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                <td className="px-6 py-4 text-sm text-gray-900">{user.full_name || "N/A"}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <RoleBadge
                    role={user.is_superadmin ? "superadmin" : (user.highest_role as "admin" | "user" | null)}
                    isSystemAdminContext={true}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Building className="w-4 h-4" />
                    {user.client_count}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatDate(user.created_at, "short")}
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
      {filteredUsers.length > 0 && (
        <div className="fixed bottom-8 right-8 flex items-center gap-4 z-10">
          <button
            className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={prevPage}
            disabled={isFirstPage}
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
                  onClick={() => goToPage(1)}
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
                        onClick={() => goToPage(2)}
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
                          onClick={() => goToPage(currentPage)}
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
                          onClick={() => goToPage(totalPages)}
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
              onClick={nextPage}
              disabled={isLastPage}
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
        )}
    </div>
  )
}

