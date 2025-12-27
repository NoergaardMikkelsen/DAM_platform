"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, Mail, Phone, Building, Settings, Trash2 } from "lucide-react"
import Link from "next/link"
import React, { useState, useEffect, useRef, use } from "react"
import { useRouter, useParams } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"

interface UserProfile {
  id: string
  full_name: string
  email: string
  phone: string | null
  department: string | null
  current_position: string | null
  created_at: string
  client_id: string
  client_name: string
  role: string
  role_name: string
  status: string
}

export default function UserDetailPage() {
  const { tenant } = useTenant()
  const paramsPromise = useParams()
  const [id, setId] = useState<string>("")
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    current_position: ""
  })
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  // Unwrap the params promise
  useEffect(() => {
    const unwrapParams = async () => {
      const resolvedParams = await paramsPromise
      setId(resolvedParams.id as string)
    }
    unwrapParams()
  }, [paramsPromise])

  useEffect(() => {
    if (!id) return
    loadUser()
  }, [id])

  const loadUser = async () => {
    // Use tenant from context - tenant layout already verified access
    const clientId = tenant.id
    const supabase = supabaseRef.current

    // Get user details with client and role info - only for this tenant
    const { data: userData } = await supabase
      .from("client_users")
      .select(`
        id,
        status,
        created_at,
        client_id,
        user_id,
        roles (
          key,
          name
        ),
        clients (
          name
        ),
        users (
          id,
          full_name,
          email,
          phone,
          department,
          current_position,
          created_at
        )
      `)
      .eq("user_id", id)
      .eq("client_id", clientId)
      .single()

    if (!userData) {
      router.push("/users")
      return
    }

    const userProfile: UserProfile = {
      id: userData.users.id,
      full_name: userData.users.full_name,
      email: userData.users.email,
      phone: userData.users.phone,
      department: userData.users.department,
      current_position: userData.users.current_position,
      created_at: userData.created_at,
      client_id: userData.client_id,
      client_name: userData.clients.name,
      role: userData.roles.key,
      role_name: userData.roles.name,
      status: userData.status
    }

    setUser(userProfile)
    setEditForm({
      full_name: userProfile.full_name,
      email: userProfile.email,
      phone: userProfile.phone || "",
      department: userProfile.department || "",
      current_position: userProfile.current_position || ""
    })

    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!user) return

    const supabase = supabaseRef.current
    setIsLoading(true)

    const { error } = await supabase
      .from("users")
      .update({
        full_name: editForm.full_name,
        phone: editForm.phone || null,
        department: editForm.department || null,
        current_position: editForm.current_position || null
      })
      .eq("id", user.id)

    if (error) {
      console.error("Error updating user:", error)
      // TODO: Show error toast
    } else {
      setIsEditing(false)
      await loadUser() // Reload data
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!user) return

    // TODO: Implement delete confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete user "${user.full_name}"? This action cannot be undone.`)

    if (!confirmed) return

    const supabase = supabaseRef.current
    setIsLoading(true)

    // Delete from client_users first (cascade will handle the rest)
    const { error } = await supabase
      .from("client_users")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      console.error("Error deleting user:", error)
      // TODO: Show error toast
    } else {
      router.push("/users")
    }

    setIsLoading(false)
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-600">User not found</p>
          <Link href="/users">
            <Button className="mt-4">Back to Users</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/users" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DF475C] text-white">
              {user.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.full_name}</h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={user.status === "active" ? "default" : "secondary"}
              className={user.status === "active" ? "bg-green-100 text-green-800" : ""}
            >
              {user.status}
            </Badge>
            {!isEditing ? (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={isLoading}>
                  Save Changes
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={handleDelete} disabled={isLoading}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Personal and professional details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                  <p className="text-gray-900">{user.full_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email</Label>
                  <p className="text-gray-900">{user.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Phone</Label>
                  <p className="text-gray-900">{user.phone || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Department</Label>
                  <p className="text-gray-900">{user.department || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Position</Label>
                  <p className="text-gray-900">{user.current_position || "Not specified"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+45 12 34 56 78"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={editForm.department}
                    onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="Marketing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current_position">Current Position</Label>
                  <Input
                    id="current_position"
                    value={editForm.current_position}
                    onChange={(e) => setEditForm(prev => ({ ...prev, current_position: e.target.value }))}
                    placeholder="Marketing Manager"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Client & Role Information */}
        <div className="space-y-6">
          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium text-gray-900">{user.client_name}</div>
              <p className="text-sm text-gray-600">Client membership</p>
            </CardContent>
          </Card>

          {/* Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Role
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium text-gray-900">{user.role_name}</div>
              <Badge
                variant="secondary"
                className={
                  user.role === "superadmin"
                    ? "bg-pink-100 text-pink-800"
                    : user.role === "admin"
                      ? "bg-red-100 text-red-800"
                      : "bg-purple-100 text-purple-800"
                }
              >
                {user.role}
              </Badge>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-700">Member since</Label>
                <p className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Account Status</Label>
                <div className="mt-1">
                  <Badge
                    variant={user.status === "active" ? "default" : "secondary"}
                    className={user.status === "active" ? "bg-green-100 text-green-800" : ""}
                  >
                    {user.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
