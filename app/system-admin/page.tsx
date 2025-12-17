import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function SystemAdminRootPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // If user is authenticated, check if they're a system admin
  if (user && !userError) {
    const { data: systemAdmin, error: adminError } = await supabase
      .from("system_admins")
      .select("id")
      .eq("id", user.id)
      .single()

    // If user is a valid system admin, redirect to dashboard
    if (systemAdmin && !adminError) {
      redirect('/system-admin/dashboard')
    }
  }

  // User is not authenticated or not a system admin
  // Redirect to login on the same subdomain
  redirect('/login')
}