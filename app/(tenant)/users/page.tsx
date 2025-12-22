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
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allUsers, roleFilter, searchQuery])

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
        <Link href="/users/create">
          <Button className="rounded-[25px]" style={{ backgroundColor: tenant.primary_color }}>
            <Plus className="mr-2 h-4 w-4" />
            Create new user
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
      <Tabs value={roleFilter} onValueChange={setRoleFilter} className="mb-6">
        <TabsList suppressHydrationWarning>
          <TabsTrigger value="all">All users</TabsTrigger>
          <TabsTrigger value="superadmin">Superadmin</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="user">User</TabsTrigger>
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
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created at</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers?.map((clientUser) => (
              <tr key={clientUser.id} className="hover:bg-gray-50 cursor-pointer">
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
