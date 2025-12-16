"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
  is_system_admin: boolean
  client_count: number
  last_active?: string
}

export default function SystemUsersPage() {
  const [allUsers, setAllUsers] = useState<SystemUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<SystemUser[]>([])
  const [userTypeFilter, setUserTypeFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    loadUsers()
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

    // Get system admin status for each user
    const { data: systemAdmins } = await supabase
      .from("system_admins")
      .select("id")

    const systemAdminIds = new Set(systemAdmins?.map(sa => sa.id) || [])

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
    const usersWithDetails: SystemUser[] = users?.map(user => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      created_at: user.created_at,
      is_system_admin: systemAdminIds.has(user.id),
      client_count: clientCountMap.get(user.id) || 0
    })) || []

    setAllUsers(usersWithDetails)
    setFilteredUsers(usersWithDetails)
    setIsLoading(false)
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
      if (userTypeFilter === "system-admin") {
        filtered = filtered.filter((user) => user.is_system_admin)
      } else if (userTypeFilter === "client-users") {
        filtered = filtered.filter((user) => !user.is_system_admin && user.client_count > 0)
      } else if (userTypeFilter === "no-clients") {
        filtered = filtered.filter((user) => !user.is_system_admin && user.client_count === 0)
      }
    }

    setFilteredUsers(filtered)
  }

  const toggleSystemAdmin = async (userId: string, currentStatus: boolean) => {
    const supabase = supabaseRef.current

    try {
      if (currentStatus) {
        // Remove system admin status
        await supabase
          .from("system_admins")
          .delete()
          .eq("id", userId)
      } else {
        // Add system admin status
        await supabase
          .from("system_admins")
          .insert({ id: userId })
      }

      // Reload users to reflect changes
      await loadUsers()
    } catch (error) {
      console.error("Error updating system admin status:", error)
    }
  }

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
        <Button className="bg-black hover:bg-gray-800 text-white rounded-[25px]">
          <Plus className="mr-2 h-4 w-4" />
          Invite new user
        </Button>
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
          <TabsTrigger value="system-admin">System Admins</TabsTrigger>
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
                    {user.is_system_admin ? (
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        <Shield className="w-3 h-3 mr-1" />
                        System Admin
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSystemAdmin(user.id, user.is_system_admin)}
                      className={`h-8 ${
                        user.is_system_admin
                          ? "text-red-600 hover:text-red-700"
                          : "text-green-600 hover:text-green-700"
                      }`}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {user.is_system_admin ? "Remove Admin" : "Make Admin"}
                    </Button>
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

