import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  const { data: clientUsers } = await supabase
    .from("client_users")
    .select(`*, roles(name)`)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)

  const role = clientUsers?.[0]?.roles?.name || "User"

  return (
    <div className="p-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Profile</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account stats</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="user">User</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="flex items-start gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#dc3545] text-2xl font-bold text-white">
                {userData?.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
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
              <form className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input id="full_name" defaultValue={userData?.full_name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" defaultValue={userData?.phone || ""} />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue={userData?.email} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_position">Current Position</Label>
                    <Input id="current_position" defaultValue={userData?.current_position || ""} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" defaultValue={userData?.department || ""} />
                </div>

                <div className="flex justify-end">
                  <Button className="bg-[#dc3545] hover:bg-[#c82333]">Edit Profile</Button>
                </div>
              </form>
            </div>
          </div>
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

        <TabsContent value="user">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Additional user information will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
