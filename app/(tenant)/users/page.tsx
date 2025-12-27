"use client"

import { createClient } from "@/lib/supabase/client"
import { getTenantUsers } from "./actions"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"
import { CreateUserModal } from "@/components/create-user-modal"

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
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([])
  const [roleFilter, setRoleFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allUsers, roleFilter, searchQuery])

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
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id

    // Use server action to bypass RLS and get all tenant users
    const usersData = await getTenantUsers(clientId)

    usersData.forEach((user, index) => {
      // Debug removed
    })

    setAllUsers(usersData)
    setFilteredUsers(usersData)
    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...allUsers]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((user) =>
        user.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.users?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.roles?.key === roleFilter)
    }

    setFilteredUsers(filtered)
    // Reset to first page when filters change
    setCurrentPage(1)
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          style={{ backgroundColor: tenant.primary_color }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create new user
        </Button>
      </div>
      <CreateUserModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Search */}
      <div className="mb-6 flex justify-end">
        <div className="relative max-w-[400px] w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <Input
            type="search"
            placeholder="Search user"
            className="pl-10 bg-white text-[#737373] placeholder:text-[#737373]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

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
            {filteredUsers?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((clientUser) => (
              <tr key={clientUser.id} className="border-b border-gray-100 last:border-b-0">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {clientUser.users?.full_name || 'N/A'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {clientUser.users?.email || 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant="secondary"
                    className={
                      clientUser.roles?.key === "superadmin"
                        ? "bg-pink-100 text-pink-800"
                        : clientUser.roles?.key === "admin"
                          ? "text-white"
                          : "bg-purple-100 text-purple-800"
                    }
                    style={clientUser.roles?.key === "admin" ? {
                      backgroundColor: tenant.primary_color
                    } : {}}
                  >
                    {clientUser.roles?.name}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(clientUser.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
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
