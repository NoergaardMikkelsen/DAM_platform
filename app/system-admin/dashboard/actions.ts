"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAllTenantsForSuperAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError) {
    console.error('[DASHBOARD-ACTIONS] Error getting user:', userError)
    return []
  }

  if (!user) {
    console.log('[DASHBOARD-ACTIONS] No user found')
    return []
  }

  // Check if user has superadmin role
  const { data: superadminCheck, error: superadminError } = await supabase
    .from("client_users")
    .select(`
      id,
      roles!inner(key)
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("roles.key", "superadmin")
    .limit(1)

  if (superadminError) {
    console.error('[DASHBOARD-ACTIONS] Error checking superadmin:', superadminError)
    return []
  }

  if (!superadminCheck || superadminCheck.length === 0) {
    console.log('[DASHBOARD-ACTIONS] User is not superadmin')
    return []
  }

  console.log('[DASHBOARD-ACTIONS] User is superadmin, fetching clients...')

  // Get all clients (superadmin can see all)
  const { data: tenants, error: tenantsError } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("status", "active")
    .order("name")

  if (tenantsError) {
    console.error('[DASHBOARD-ACTIONS] Error fetching clients:', tenantsError)
    return []
  }

  console.log('[DASHBOARD-ACTIONS] Found clients:', tenants?.length || 0, tenants)

  return tenants || []
}
