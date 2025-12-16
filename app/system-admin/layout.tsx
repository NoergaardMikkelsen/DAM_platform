import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SystemAdminSidebar } from "@/components/system-admin/sidebar"

export default async function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verify system admin authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Check system admin table only (never use client_users)
  const { data: systemAdmin, error } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", user.id)
    .single()

  if (error || !systemAdmin) {
    // Not a system admin - redirect to login
    redirect("/login")
  }

  // System admin confirmed - render isolated layout
  return (
    <div className="flex h-screen bg-gray-50">
      <SystemAdminSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
