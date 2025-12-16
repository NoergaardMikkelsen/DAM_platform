"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAllTenantsForSuperAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: systemAdmin } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!systemAdmin) return []

  const { data: tenants } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("status", "active")
    .order("name")

  return tenants || []
}
