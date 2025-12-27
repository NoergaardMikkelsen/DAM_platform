"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { RoleBadge } from "@/components/role-badge"
import { formatDate } from "@/lib/utils/date"
import { useToast } from "@/hooks/use-toast"
import { handleError, handleSuccess } from "@/lib/utils/error-handling"
import { logError } from "@/lib/utils/logger"

interface SystemAdminData {
  id: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
}

interface SystemActivity {
  id: string
  action: string
  details: string
  timestamp: string
  type: 'client' | 'user' | 'asset' | 'system'
}

export default function SystemAdminProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<SystemAdminData | null>(null)
  const [activities, setActivities] = useState<SystemActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingActivities, setIsLoadingActivities] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: ""
  })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    loadProfile()
    loadActivities()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()

    // Authentication and authorization is already handled by system-admin layout
    // Get current user from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push("/login")
      return
    }

    setUser(user)

    const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

    setUserData(userData)
    setEditForm({
      full_name: userData?.full_name || "",
      phone: userData?.phone || ""
    })

    setIsLoading(false)
  }

  const loadActivities = async () => {
    const supabase = createClient()
    setIsLoadingActivities(true)

    try {
      // Get recent client creation activities
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, created_at")
        .order("created_at", { ascending: false })
        .limit(5)

      // Get recent user creation activities
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5)

      // Get recent client-user associations (admin assignments)
      const { data: clientUsers } = await supabase
        .from("client_users")
        .select(`
          id,
          created_at,
          clients (name),
          roles (key)
        `)
        .order("created_at", { ascending: false })
        .limit(5)

      // Combine and format activities
      const allActivities: SystemActivity[] = []

      // Client creation activities
      clients?.forEach((client: any) => {
        allActivities.push({
          id: `client-${client.id}`,
          action: "Created new client",
          details: client.name,
          timestamp: client.created_at,
          type: 'client'
        })
      })

      // User creation activities
      users?.forEach((user: any) => {
        allActivities.push({
          id: `user-${user.id}`,
          action: "Created new user",
          details: user.full_name || "Unknown user",
          timestamp: user.created_at,
          type: 'user'
        })
      })

      // Admin assignment activities
      clientUsers?.forEach((cu: any) => {
        if (cu.roles?.key === 'admin' || cu.roles?.key === 'superadmin') {
          allActivities.push({
            id: `assignment-${cu.id}`,
            action: `Assigned ${cu.roles.key} role`,
            details: `${cu.clients?.name || 'Unknown client'}`,
            timestamp: cu.created_at,
            type: 'user'
          })
        }
      })

      // Sort by timestamp and take the most recent 10
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      const recentActivities = allActivities.slice(0, 10)

      setActivities(recentActivities)
    } catch (error) {
      logError("Error loading activities:", error)
      // Set some fallback activities if error occurs
      setActivities([
        {
          id: 'fallback-1',
          action: 'System initialized',
          details: 'DAM platform ready',
          timestamp: new Date().toISOString(),
          type: 'system'
        }
      ])
    } finally {
      setIsLoadingActivities(false)
    }
  }

  const handleEdit = async () => {
    if (!userData) return

    const supabase = createClient()
    setIsLoading(true)

    const { error } = await supabase
      .from("users")
      .update({
        full_name: editForm.full_name,
        phone: editForm.phone || null
      })
      .eq("id", userData.id)

    if (error) {
      handleError(error, toast, {
        title: "Failed to update profile",
        description: "Could not update profile information. Please try again.",
      })
    } else {
      setIsEditing(false)
      handleSuccess(toast, "Profile updated successfully")
      await loadProfile() // Reload data
    }

    setIsLoading(false)
  }

  const initials =
    userData?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || ""

  const profileContent = () => {
    if (isLoading) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-start gap-12">
        <div className="flex flex-col items-center gap-4 shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black text-2xl font-bold text-white">
            {initials}
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 text-lg">{userData?.full_name}</div>
            <div className="text-sm text-gray-500 mt-1">
              System Administrator
            </div>
            <div className="mt-3">
              <RoleBadge
                role="superadmin"
                isSystemAdminContext={true}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!isEditing ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <p className="text-gray-900">{userData?.full_name}</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <p className="text-gray-900">{userData?.phone || "Not provided"}</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-gray-900">{userData?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Member since</Label>
                  <p className="text-gray-900">
                    {userData?.created_at ? formatDate(userData.created_at, "long") : "Unknown"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="bg-black hover:bg-gray-800 text-white" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-6" autoComplete="off" suppressHydrationWarning>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+45 12 34 56 78"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={userData?.email || ""} disabled className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Member since</Label>
                  <p className="text-gray-900 pt-2">
                    {userData?.created_at ? formatDate(userData.created_at, "long") : "Unknown"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button className="bg-black hover:bg-gray-800 text-white" onClick={handleEdit} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Profile</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-0">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <Card className="border-0 rounded-t-none">
            <CardContent className="pt-6">
              {profileContent()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <Card className="border-0 rounded-t-none">
            <CardHeader>
              <CardTitle>System Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">Recent system administration activities:</p>
                {isLoadingActivities ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{activity.action}</p>
                          <p className="text-xs text-gray-500">{activity.details}</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(activity.timestamp, "withTime")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent activities found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <Card className="border-0 rounded-t-none">
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Notifications</h4>
                  <p className="text-sm text-gray-600">
                    Receive email updates about system events
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Email notifications</p>
                        <p className="text-xs text-gray-500">Receive email updates about system events</p>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Security alerts</p>
                        <p className="text-xs text-gray-500">Get notified about security-related events</p>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Security</h4>
                  <div className="space-y-3">
                    <Button variant="secondary" size="sm">
                      Change Password
                    </Button>
                    <Button variant="secondary" size="sm">
                      Enable Two-Factor Authentication
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Danger Zone</h4>
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <p className="text-sm text-red-800 mb-3">
                      These actions are irreversible. Please be certain before proceeding.
                    </p>
                    <Button variant="destructive" size="sm">
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
