import type React from "react"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"
import { createClient } from "@/lib/supabase/server"
import { BrandProvider } from "@/lib/context/brand-context"

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  if (!userData) {
    redirect("/login")
  }

  const { data: clientUsers } = await supabase
    .from("client_users")
    .select(
      `
      client_id,
      role_id,
      roles!inner (
        key,
        name
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)

  const roleEntry = clientUsers?.[0]?.roles as { key?: string | null } | { key?: string | null }[] | null | undefined
  const roleKey = Array.isArray(roleEntry) ? roleEntry[0]?.key : roleEntry?.key
  const role = roleKey?.toLowerCase()

  console.log("User role data:", {
    userId: user.id,
    clientUsers,
    role,
    rawRoleKey: roleKey,
  })

  return (
    <BrandProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <SidebarVisibility>
          <Sidebar user={userData} role={role} />
        </SidebarVisibility>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </BrandProvider>
  )
}
