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

  // Debug logging
  const debugLog: string[] = []
  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] Starting layout check`)
  
  // Verify system admin authentication
  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] Getting user...`)
  const { data: { user }, error: getUserError } = await supabase.auth.getUser()

  if (getUserError) {
    debugLog.push(`[SYSTEM-ADMIN-LAYOUT] Get user error: ${getUserError.message}`)
    console.error('[SYSTEM-ADMIN-LAYOUT DEBUG]', debugLog.join('\n'))
  }

  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] User: ${user ? `found (id: ${user.id}, email: ${user.email})` : 'not found'}`)

  if (!user) {
    debugLog.push(`[SYSTEM-ADMIN-LAYOUT] No user found, redirecting to login`)
    console.error('[SYSTEM-ADMIN-LAYOUT DEBUG]', debugLog.join('\n'))
    redirect("/login")
  }

  // SYSTEM ADMIN CONTEXT ONLY: Check system admin table only (never use client_users)
  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] Checking system admin table for user ${user.id}...`)
  const { data: systemAdmin, error } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", user.id)
    .single()

  if (error) {
    debugLog.push(`[SYSTEM-ADMIN-LAYOUT] System admin query error: ${error.message}`)
  }

  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] System admin result: ${systemAdmin ? 'found' : 'not found'}`)

  if (error || !systemAdmin) {
    // Not a system admin - show access denied page instead of redirecting to login
    debugLog.push(`[SYSTEM-ADMIN-LAYOUT] User is not a system admin, showing access denied`)
    console.error('[SYSTEM-ADMIN-LAYOUT DEBUG]', debugLog.join('\n'))
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
            <details className="text-xs text-gray-600 bg-gray-50 p-2 rounded border max-h-60 overflow-auto mb-4">
              <summary className="cursor-pointer font-medium">Debug Details</summary>
              <pre className="mt-2 whitespace-pre-wrap">{debugLog.join('\n')}</pre>
            </details>
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
  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] Getting user data from users table...`)
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (userDataError) {
    debugLog.push(`[SYSTEM-ADMIN-LAYOUT] User data query error: ${userDataError.message}`)
  }

  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] User data result: ${userData ? 'found' : 'not found'}`)

  if (!userData) {
    debugLog.push(`[SYSTEM-ADMIN-LAYOUT] No user data found, redirecting to login`)
    console.error('[SYSTEM-ADMIN-LAYOUT DEBUG]', debugLog.join('\n'))
    redirect("/login")
  }

  debugLog.push(`[SYSTEM-ADMIN-LAYOUT] All checks passed, rendering layout`)
  console.log('[SYSTEM-ADMIN-LAYOUT DEBUG]', debugLog.join('\n'))

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
