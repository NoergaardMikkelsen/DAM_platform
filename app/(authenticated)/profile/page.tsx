"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect } from "react"

interface UserData {
  id: string
  full_name: string
  email: string
  phone: string | null
  department: string | null
  current_position: string | null
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [role, setRole] = useState<string>("User")
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    department: "",
    current_position: ""
  })
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    setUser(user)

    const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

    const { data: clientUsers } = await supabase
      .from("client_users")
      .select(`*, roles(name)`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)

    const role = clientUsers?.[0]?.roles?.name || "User"

    setUserData(userData)
    setRole(role)
    setEditForm({
      full_name: userData?.full_name || "",
      phone: userData?.phone || "",
      department: userData?.department || "",
      current_position: userData?.current_position || ""
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
        phone: editForm.phone || null,
        department: editForm.department || null,
        current_position: editForm.current_position || null
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

  return (
    <div className="p-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Profile</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account stats</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
<<<<<<< Updated upstream
          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#dc3545] border-t-transparent" />
                <p className="text-gray-600">Loading profile...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-8">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#dc3545] text-2xl font-bold text-white">
                  {initials}
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{userData?.full_name}</div>
                  <div className="text-sm text-gray-500">
                    {userData?.department ? `${userData.department}` : "Odense, Denmark"}
                  </div>
                  <div className="mt-2 inline-block rounded-full bg-pink-100 px-3 py-1 text-xs font-medium text-pink-800">
                    {role}
=======
          <div className="flex items-start gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#dc3545] text-2xl font-bold text-white">
                {initials}
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{userData?.full_name}</div>
                <div className="text-sm text-gray-500">
                  {userData?.department ? `${userData.department}` : "Odense, Denmark"}
                </div>
                <div className="mt-2 inline-block rounded-full bg-pink-100 px-3 py-1 text-xs font-medium text-pink-800">
                  {role}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <form className="space-y-6" autoComplete="off" suppressHydrationWarning>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input id="full_name" defaultValue={userData?.full_name} autoComplete="off" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" defaultValue={userData?.phone || ""} autoComplete="off" />
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
                  </div>
                </div>
              </div>

<<<<<<< Updated upstream
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
                        <Label>Current Position</Label>
                        <p className="text-gray-900">{userData?.current_position || "Not specified"}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Department</Label>
                      <p className="text-gray-900">{userData?.department || "Not specified"}</p>
                    </div>

                    <div className="flex justify-end">
                      <Button className="bg-[#dc3545] hover:bg-[#c82333]" onClick={() => setIsEditing(true)}>
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
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
                        <Label htmlFor="current_position">Current Position</Label>
                        <Input
                          id="current_position"
                          value={editForm.current_position}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, current_position: e.target.value }))}
                          placeholder="Marketing Manager"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={editForm.department}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                        placeholder="Marketing"
                        autoComplete="off"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                        Cancel
                      </Button>
                      <Button className="bg-[#dc3545] hover:bg-[#c82333]" onClick={handleEdit} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
=======
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue={userData?.email} autoComplete="off" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_position">Current Position</Label>
                    <Input id="current_position" defaultValue={userData?.current_position || ""} autoComplete="off" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" defaultValue={userData?.department || ""} autoComplete="off" />
                </div>

                <div className="flex justify-end">
                  <Button className="bg-[#dc3545] hover:bg-[#c82333]">Edit Profile</Button>
                </div>
              </form>
>>>>>>> Stashed changes
            </div>
          )}
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Account statistics will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Account settings will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
