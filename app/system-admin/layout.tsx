"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"

interface UserData {
  id: string
  email: string
  full_name: string
  // Add other user properties as needed
}

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const supabase = createClient()

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.info('[SYSTEM-ADMIN-LAYOUT] Session error, redirecting to login')
        router.push('/login')
        return
      }

      if (!session?.user) {
        console.info('[SYSTEM-ADMIN-LAYOUT] No session, redirecting to login')
        router.push('/login')
        return
      }

      // Check if user has superadmin role in any client
      const { data: superadminCheck, error: adminError } = await supabase
        .from("client_users")
        .select(`
          id,
          roles!inner(key)
        `)
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .eq("roles.key", "superadmin")
        .limit(1)

      if (adminError || !superadminCheck || superadminCheck.length === 0) {
        console.info('[SYSTEM-ADMIN-LAYOUT] User is not superadmin')
        setIsAuthorized(false)
        setIsLoading(false)
        return
      }

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (userError || !userData) {
        console.info('[SYSTEM-ADMIN-LAYOUT] User data not found, redirecting to login')
        router.push('/login')
        return
      }

      // Ensure required fields are present
      const formattedUser: UserData = {
        id: userData.id,
        email: userData.email || session.user.email,
        full_name: userData.full_name || session.user.user_metadata?.full_name || 'Unknown User'
      }

      setUser(formattedUser)
      setIsAuthorized(true)

    } catch (error) {
      console.error('[SYSTEM-ADMIN-LAYOUT] Auth check failed:', error)
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
            <p className="mt-2 text-sm text-gray-600">Setting up your session.</p>
          </div>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-sm text-gray-600">You don't have permission to access the system admin area.</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              If you believe this is an error, please contact your system administrator.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="inline-block px-4 py-2 bg-black text-white rounded-[25px] hover:bg-gray-800 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // This shouldn't happen, but just in case
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SidebarVisibility>
        <Sidebar user={user} role="superadmin" isSystemAdminContext={true} />
      </SidebarVisibility>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
