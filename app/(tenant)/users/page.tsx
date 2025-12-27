"use client"

import { createClient } from "@/lib/supabase/client"
import { getTenantUsers } from "./actions"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { RoleBadge } from "@/components/role-badge"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { CreateUserModal } from "@/components/create-user-modal"
import { formatDate } from "@/lib/utils/date"
import { usePagination } from "@/hooks/use-pagination"
import { PAGINATION } from "@/lib/constants"
import { PageHeader } from "@/components/page-header"
import { useSearchFilter } from "@/hooks/use-search-filter"

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
  const { tenant } = useTenant()
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([])
  const [roleFilter, setRoleFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
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

  // Show loading skeleton while checking access (before redirect happens)
  if (isLoading) {
    return (
      <div className="p-8">
        <ListPageHeaderSkeleton showCreateButton={true} />
        <SearchSkeleton />
        <TabsSkeleton count={4} />
        <TableSkeleton rows={8} columns={4} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Users"
        createButton={{
          label: "Create new user",
          onClick: () => setIsCreateModalOpen(true),
          style: { backgroundColor: tenant.primary_color },
        }}
        search={{
          placeholder: "Search user",
          value: searchQuery,
          onChange: setSearchQuery,
          position: "below",
        }}
      />
      <CreateUserModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Tabs */}
      <Tabs value={roleFilter} onValueChange={setRoleFilter} className="mb-0">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All users</TabsTrigger>
          <TabsTrigger value="superadmin">Superadmin</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="user">User</TabsTrigger>
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
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created at</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900 last:pr-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((clientUser) => (
              <tr key={clientUser.id} className="border-b border-gray-100 last:border-b-0">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {clientUser.users?.full_name || 'N/A'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {clientUser.users?.email || 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <RoleBadge
                    role={clientUser.roles?.key as "superadmin" | "admin" | "user" | null}
                    tenantPrimaryColor={tenant.primary_color}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatDate(clientUser.created_at, "short")}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/users/${clientUser.users?.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4 text-gray-600" />
                      </Button>
                    </Link>
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
