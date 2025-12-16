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

  // SYSTEM ADMIN CONTEXT ONLY: Check system admin table only (never use client_users)
  const { data: systemAdmin, error } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", user.id)
    .single()

  if (error || !systemAdmin) {
    // Not a system admin - show access denied page instead of redirecting to login
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-sm text-gray-600">You don't have permission to access the system admin area.</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              If you believe this is an error, please contact your system administrator.
            </p>
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-[#DF475C] text-white rounded-[25px] hover:bg-[#C82333] transition-colors"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Get user data
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!userData) {
    redirect("/login")
  }

  // System admin confirmed - render system admin layout
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
