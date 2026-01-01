"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RoleBadge } from "@/components/role-badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Trash2, Users, Building } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { usePagination } from "@/hooks/use-pagination"
import { PAGINATION, DEFAULT_ROLES } from "@/lib/constants"
import { formatDate } from "@/lib/utils/date"
import { useSearchFilter } from "@/hooks/use-search-filter"
import { logError } from "@/lib/utils/logger"
import { EmptyState } from "@/components/empty-state"
import { TablePage, TableColumn } from "@/components/table-page"

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

// Note: Superadmin identification now uses system_admins table instead of SYSTEM_CLIENT_ID

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
    role: DEFAULT_ROLES.ADMIN as 'admin' | 'user' | 'superadmin' // default to admin
  })
  const [createUserError, setCreateUserError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    role: 'user' as 'admin' | 'user' | 'superadmin'
  })
  const [editSelectedClients, setEditSelectedClients] = useState<string[]>([])
  const [editUserLoading, setEditUserLoading] = useState(false)
  const [editUserError, setEditUserError] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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
    totalItems,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setItemsPerPage,
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
    // Start with null and only update if we find a role
    let highestRole: 'admin' | 'user' | 'superadmin' | null = null
    const clientIds: string[] = []

    // Check if user is a system admin (superadmin)
    const { data: systemAdminCheck } = await supabase
      .from("system_admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    const isSystemAdmin = !!systemAdminCheck

    userClientData?.forEach((ucd: { client_id: string; roles: { key: string } }) => {
      // Include all client associations (no need to exclude system client anymore)
      clientIds.push(ucd.client_id)
      // Update highest role based on what we find
      if (ucd.roles.key === 'admin' && highestRole !== 'superadmin') {
        highestRole = 'admin'
      } else if (ucd.roles.key === 'user' && !highestRole) {
        highestRole = 'user'
      }
    })

    // If user is a system admin, set role to superadmin
    if (isSystemAdmin) {
      highestRole = 'superadmin'
    }

    // If no role found, use the user's highest_role from the SystemUser object
    // This handles cases where user might not have any client associations yet
    if (highestRole === null) {
      highestRole = (user.highest_role as 'admin' | 'user' | 'superadmin' | null) || 'user'
    }

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

      // Check if user is currently a superadmin (has entry in system_admins table)
      const { data: currentSystemAdminEntry } = await supabase
        .from('system_admins')
        .select('id')
        .eq('id', editingUser.id)
        .maybeSingle()

      const wasSuperadmin = !!currentSystemAdminEntry
      const isBecomingSuperadmin = editUserForm.role === 'superadmin' && !wasSuperadmin
      const isRemovingSuperadmin = wasSuperadmin && editUserForm.role !== 'superadmin'

      // Handle superadmin role changes
      if (isBecomingSuperadmin) {
        // User is being promoted to superadmin
        // 1. Get superadmin role ID
        const { data: superadminRoleData, error: superadminRoleError } = await supabase
          .from('roles')
          .select('id')
          .eq('key', 'superadmin')
          .single()

        if (superadminRoleError) throw superadminRoleError

        // 2. Create superadmin entry in system_admins table
        // This identifies the user as a superadmin and gives access to system-admin area
        // Note: No need to create entry in client_users for SYSTEM_CLIENT_ID anymore
        const { error: superadminError } = await supabase
          .from('system_admins')
          .insert({
            id: editingUser.id,
            role_id: superadminRoleData.id
          })

        if (superadminError) throw superadminError

        // 3. Get all active clients and create admin entries for superadmin
        // Superadmins get admin role on all tenants (not superadmin role) for tenant access
        const { data: allActiveClients, error: clientsError } = await supabase
          .from('clients')
          .select('id')
          .eq('status', 'active')

        if (clientsError) throw clientsError

        if (allActiveClients && allActiveClients.length > 0) {
          const { data: adminRoleData, error: adminRoleError } = await supabase
            .from('roles')
            .select('id')
            .eq('key', 'admin')
            .single()

          if (adminRoleError) throw adminRoleError

          // Get current tenant associations to avoid duplicates
          const { data: currentTenantAssociations } = await supabase
            .from('client_users')
            .select('client_id')
            .eq('user_id', editingUser.id)
            .eq('status', 'active')

          const currentTenantIds = currentTenantAssociations?.map((ca: ClientAssociation) => ca.client_id) || []

          // Create admin entries for tenants not already associated
          const tenantsToAdd = allActiveClients
            .filter((client: { id: string }) => !currentTenantIds.includes(client.id))
            .map((client: { id: string }) => ({
              user_id: editingUser.id,
              client_id: client.id,
              role_id: adminRoleData.id,
              status: 'active'
            }))

          if (tenantsToAdd.length > 0) {
            const { error: adminEntriesError } = await supabase
              .from('client_users')
              .insert(tenantsToAdd)

            if (adminEntriesError) throw adminEntriesError
          }

          // Update existing tenant associations to admin role
          if (currentTenantIds.length > 0) {
            const { error: updateTenantError } = await supabase
              .from('client_users')
              .update({ role_id: adminRoleData.id })
              .eq('user_id', editingUser.id)
              .in('client_id', currentTenantIds)
              .eq('status', 'active')

            if (updateTenantError) throw updateTenantError
          }
        }
      } else if (isRemovingSuperadmin) {
        // User is being demoted from superadmin
        // Remove superadmin entry from system_admins table
        const { error: removeSuperadminError } = await supabase
          .from('system_admins')
          .delete()
          .eq('id', editingUser.id)

        if (removeSuperadminError) throw removeSuperadminError
      }

      // Handle tenant client associations (for non-superadmin or when superadmin role is maintained)
      if (editUserForm.role !== 'superadmin' || !isBecomingSuperadmin) {
        // Get current tenant associations
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

        // Get role ID for client assignments
        const roleKeyForClients = editUserForm.role === 'superadmin' ? 'admin' : editUserForm.role
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('key', roleKeyForClients)
          .single()

        if (roleError) throw roleError

        // Remove associations for clients no longer selected
        if (clientsToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('client_users')
            .delete()
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

        // Update existing associations to ensure they use the correct role
        if (editSelectedClients.length > 0) {
          const { error: updateError } = await supabase
            .from('client_users')
            .update({ role_id: roleData.id })
            .eq('user_id', editingUser.id)
            .in('client_id', editSelectedClients)
            .eq('status', 'active')

          if (updateError) throw updateError
        }
      }

      // Reset form and close modal
      setIsEditModalOpen(false)
      setEditingUser(null)
      setEditUserForm({
        fullName: '',
        email: '',
        role: 'user' as 'admin' | 'user' | 'superadmin'
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

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    const supabase = supabaseRef.current
    setIsDeleting(true)

    try {
      // Delete all client_users entries for this user (cascade will handle the rest)
      const { error } = await supabase
        .from('client_users')
        .delete()
        .eq('user_id', userToDelete.id)

      if (error) throw error

      // Close dialog and reset state
      setIsDeleteDialogOpen(false)
      setUserToDelete(null)

      // Reload users list
      loadUsers()
    } catch (error: unknown) {
      setEditUserError(error instanceof Error ? error.message : "Failed to delete user")
    } finally {
      setIsDeleting(false)
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
        if (createUserForm.role === 'superadmin') {
          // Superadmin: 
          // 1. Create superadmin entry in system_admins table (for system-admin access identification)
          // 2. Automatically create admin entries on ALL active tenants (for tenant access)
          // Note: Superadmins do NOT need an entry in client_users for SYSTEM_CLIENT_ID anymore
          // Superadmin identification is now handled via system_admins table
          
          // Get superadmin role ID
          const { data: superadminRoleData, error: superadminRoleError } = await supabase
            .from('roles')
            .select('id')
            .eq('key', 'superadmin')
            .single()

          if (superadminRoleError) throw superadminRoleError

          // Get admin role ID (for tenant assignments)
          const { data: adminRoleData, error: adminRoleError } = await supabase
            .from('roles')
            .select('id')
            .eq('key', 'admin')
            .single()

          if (adminRoleError) throw adminRoleError

          // Create superadmin entry in system_admins table
          // This identifies the user as a superadmin and gives access to system-admin area
          const { error: superadminError } = await supabase
            .from('system_admins')
            .insert({
              id: authData.user.id,
              role_id: superadminRoleData.id
            })

          if (superadminError) throw superadminError

          // Get ALL active clients and create admin entries for superadmin
          // Superadmins get admin role on all tenants (not superadmin role) for tenant access
          const { data: allActiveClients, error: clientsError } = await supabase
            .from('clients')
            .select('id')
            .eq('status', 'active')

          if (clientsError) throw clientsError

          if (allActiveClients && allActiveClients.length > 0) {
            // Create admin entries for superadmin on all active tenants (for tenant access)
            const adminEntries = allActiveClients.map((client: { id: string }) => ({
              user_id: authData.user.id,
              client_id: client.id,
              role_id: adminRoleData.id, // Admin role on tenants (NOT superadmin)
              status: 'active'
            }))

            const { error: adminEntriesError } = await supabase
              .from('client_users')
              .insert(adminEntries)

            if (adminEntriesError) throw adminEntriesError
          }
        } else {
          // Admin or User: Only create entries for manually selected clients
          // Get role ID for client assignments
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('key', createUserForm.role)
            .single()

          if (roleError) throw roleError

          // Create client_users entries for selected clients only
          const clientUserInserts = selectedClients.map(clientId => ({
            user_id: authData.user.id,
            client_id: clientId,
            role_id: roleData.id, // Use user's selected role (admin or user)
            status: 'active'
          }))

          if (clientUserInserts.length > 0) {
            const { error: clientUserError } = await supabase
              .from('client_users')
              .insert(clientUserInserts)

            if (clientUserError) throw clientUserError
          }
        }
      }

      // Reset form and close modal
      setCreateUserForm({
        email: '',
        password: '',
        fullName: '',
        role: DEFAULT_ROLES.ADMIN as 'admin' | 'user' | 'superadmin'
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

  const columns: TableColumn<SystemUser>[] = [
    {
      header: "Name",
      render: (user) => user.full_name || "N/A",
    },
    {
      header: "Email",
      render: (user) => user.email,
    },
    {
      header: "Role",
      render: (user) => (
        <RoleBadge
          role={user.is_superadmin ? "superadmin" : (user.highest_role as "admin" | "user" | null)}
          isSystemAdminContext={true}
        />
      ),
    },
    {
      header: "Clients",
      render: (user) => (
        <div className="flex items-center gap-1">
          <Building className="w-4 h-4" />
          {user.client_count}
        </div>
      ),
    },
    {
      header: "Created",
      render: (user) => formatDate(user.created_at, "short"),
    },
    {
      header: "Actions",
      align: "right",
      render: (user) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleEditUser(user)}
          >
            <Pencil className="h-4 w-4 text-gray-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => {
              setUserToDelete(user)
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
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
      <TableSkeleton rows={8} columns={6} />
    </>
  )

  return (
    <TablePage
        title="System Users"
        search={{
          placeholder: "Search users",
          value: searchQuery,
          onChange: setSearchQuery,
          position: "below",
        }}
        createButton={{
          label: "Invite new user",
          onClick: () => setIsCreateModalOpen(true),
          className: "bg-black hover:bg-gray-800 text-white",
        }}
      tabs={{
        value: userTypeFilter,
        onChange: setUserTypeFilter,
        items: [
          { value: "all", label: "All users" },
          { value: "superadmin", label: "Superadmins" },
          { value: "client-users", label: "Client Users" },
          { value: "no-clients", label: "No Clients" },
        ],
      }}
      columns={columns}
      data={filteredUsers}
      getRowKey={(user) => user.id}
      pagination={{
        currentPage,
        itemsPerPage,
        totalPages,
        paginatedItems: paginatedUsers,
        totalItems,
        goToPage,
        nextPage,
        prevPage,
        firstPage,
        lastPage,
        setItemsPerPage,
        isFirstPage,
        isLastPage,
      }}
      isLoading={isLoading}
      loadingSkeleton={loadingSkeleton}
    >
      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
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
                  onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role: value as 'admin' | 'user' | 'superadmin' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
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
                  onValueChange={(value) => setEditUserForm(prev => ({ ...prev, role: value as 'admin' | 'user' | 'superadmin' }))}
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user "{userToDelete?.full_name || userToDelete?.email}"? 
              This action cannot be undone and will remove all client associations for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
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

