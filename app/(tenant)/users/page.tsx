"use client"

import { createClient } from "@/lib/supabase/client"
import { getTenantUsers } from "./actions"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RoleBadge } from "@/components/role-badge"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { CreateUserModal } from "@/components/create-user-modal"
import { formatDate } from "@/lib/utils/date"
import { usePagination } from "@/hooks/use-pagination"
import { PAGINATION } from "@/lib/constants"
import { useSearchFilter } from "@/hooks/use-search-filter"
import { TablePage, TableColumn } from "@/components/table-page"

interface UserWithRole {
  id: string
  status: string
  created_at: string
  roles: {
    name: string
    key: string
  } | null
  users: {
    id: string
    full_name: string
    email: string
  } | null
}

export default function UsersPage() {
  const { tenant, role } = useTenant()
  const isAdmin = role === 'admin' || role === 'superadmin'
  const canCreate = isAdmin // Only admins and superadmins can create users
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([])
  const [roleFilter, setRoleFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const supabaseRef = useRef(createClient())

  // Use search filter hook
  const {
    searchQuery,
    setSearchQuery,
    filteredItems: searchFilteredUsers,
  } = useSearchFilter({
    items: allUsers,
    searchFields: (user) => [
      user.users?.full_name || "",
      user.users?.email || "",
    ],
  })

  // Apply role filter on top of search filter
  const filteredUsers = roleFilter === "all"
    ? searchFilteredUsers
    : searchFilteredUsers.filter((user) => user.roles?.key === roleFilter)

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
  }, [])

  const loadUsers = async () => {
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    // Use server action to bypass RLS and get all tenant users
    const usersData = await getTenantUsers(clientId)

    usersData.forEach((user, index) => {
      // Debug removed
    })

    setAllUsers(usersData)
    setIsLoading(false)
  }

  const handleCreateSuccess = () => {
    loadUsers()
  }

  const columns: TableColumn<UserWithRole>[] = [
    {
      header: "Name",
      render: (user) => user.users?.full_name || 'N/A',
    },
    {
      header: "Email",
      render: (user) => user.users?.email || 'N/A',
    },
    {
      header: "Role",
      render: (user) => (
        <RoleBadge
          role={user.roles?.key as "superadmin" | "admin" | "user" | null}
          tenantPrimaryColor={tenant.primary_color}
        />
      ),
    },
    {
      header: "Created at",
      render: (user) => formatDate(user.created_at, "short"),
    },
    {
      header: "Actions",
      align: "right",
      render: (user) => (
        <div className="flex items-center justify-end gap-2">
          {isAdmin && (
            <>
              <Link href={`/users/${user.users?.id}`} onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pencil className="h-4 w-4 text-gray-600" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  const loadingSkeleton = (
    <>
      <ListPageHeaderSkeleton showCreateButton={canCreate} />
      <SearchSkeleton />
      <TabsSkeleton count={4} />
      <TableSkeleton rows={8} columns={5} />
    </>
  )

  return (
    <>
      <TablePage
        title="Users"
        createButton={canCreate ? {
          label: "Create new user",
          onClick: () => setIsCreateModalOpen(true),
          style: { backgroundColor: tenant.primary_color },
        } : undefined}
        search={{
          placeholder: "Search user",
          value: searchQuery,
          onChange: setSearchQuery,
          position: "below",
        }}
        tabs={{
          value: roleFilter,
          onChange: setRoleFilter,
          items: [
            { value: "all", label: "All users" },
            { value: "superadmin", label: "Superadmin" },
            { value: "admin", label: "Admin" },
            { value: "user", label: "User" },
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
          goToPage,
          nextPage,
          prevPage,
          isFirstPage,
          isLastPage,
        }}
        isLoading={isLoading}
        loadingSkeleton={loadingSkeleton}
      >
        <CreateUserModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onSuccess={handleCreateSuccess}
        />
      </TablePage>
    </>
  )
}
