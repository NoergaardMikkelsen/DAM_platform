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
import { Shield, Activity, Settings } from "lucide-react"

interface SystemAdminData {
  id: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
}

export default function SystemAdminProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<SystemAdminData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: ""
  })
  const router = useRouter()

  useEffect(() => {
    loadProfile()
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
      console.error("Error updating profile:", error)
      // TODO: Show error toast
    } else {
      setIsEditing(false)
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
      <div className="flex items-start gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black text-2xl font-bold text-white">
            {initials}
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{userData?.full_name}</div>
            <div className="text-sm text-gray-500">
              System Administrator
            </div>
            <div className="mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
              <Shield className="w-3 h-3 inline mr-1" />
              System Admin
            </div>
          </div>
        </div>

        <div className="flex-1">
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
                    {userData?.created_at
                      ? new Date(userData.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Unknown"
                    }
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
                    {userData?.created_at
                      ? new Date(userData.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Unknown"
                    }
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
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
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Profile</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          {profileContent()}
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">Recent system administration activities:</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Created new client</p>
                      <p className="text-xs text-gray-500">Molslinjen A/S</p>
                    </div>
                    <span className="text-xs text-gray-500">2 hours ago</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Updated system settings</p>
                      <p className="text-xs text-gray-500">Security policies</p>
                    </div>
                    <span className="text-xs text-gray-500">1 day ago</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Managed user permissions</p>
                      <p className="text-xs text-gray-500">5 users affected</p>
                    </div>
                    <span className="text-xs text-gray-500">3 days ago</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Settings
              </CardTitle>
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
                    <Button variant="outline" size="sm">
                      Change Password
                    </Button>
                    <Button variant="outline" size="sm">
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
