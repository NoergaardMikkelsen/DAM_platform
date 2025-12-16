import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"
import { BrandProvider } from "@/lib/context/brand-context"

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

  // Get user data
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  // System admin confirmed - render with same components as client layout
  return (
    <BrandProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <SidebarVisibility>
          <Sidebar user={userData} role="superadmin" />
        </SidebarVisibility>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </BrandProvider>
  )
}
