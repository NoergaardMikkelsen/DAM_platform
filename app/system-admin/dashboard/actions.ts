"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAllTenantsForSuperAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Check if user has superadmin role using the is_superadmin function
  const { data: isSuperAdmin } = await supabase.rpc('is_superadmin', {
    p_user_id: user.id
  })

  if (!isSuperAdmin) return []

  const { data: tenants } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("status", "active")
    .order("name")

  return tenants || []
}
