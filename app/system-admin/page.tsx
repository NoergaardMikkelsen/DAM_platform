import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function SystemAdminRootPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // If user is authenticated, check if they're a superadmin
  if (user && !userError) {
    // Check if user has superadmin role using the is_superadmin function
    const { data: isSuperAdmin, error: superAdminError } = await supabase.rpc('is_superadmin', {
      p_user_id: user.id
    })

    // If user is a valid superadmin, redirect to dashboard
    if (isSuperAdmin && !superAdminError) {
      redirect('/system-admin/dashboard')
    }
  }

  // User is not authenticated or not a system admin
  // Redirect to login on the same subdomain
  redirect('/login')
}