import { createClient } from "@/lib/supabase/server"

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  return userData
}

export async function getUserClients() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: clientUsers } = await supabase
    .from("client_users")
    .select(`
      *,
      clients (*),
      roles (*)
    `)
    .eq("user_id", user.id)
    .eq("status", "active")

  return clientUsers || []
}

export async function getUserRole(clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // TENANT ROLE ONLY: Always check client_users table
  // Superadmin role is checked separately via isUserSuperAdmin()
  const { data } = await supabase
    .from("client_users")
    .select(`
      roles (key)
    `)
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .eq("status", "active")
    .single()

  return data?.roles?.[0]?.key || null
}

/**
 * Check if user is a system admin (superadmin)
 * Uses the dedicated system_admins table instead of client_users
 */
export async function isUserSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  // Check if user exists in system_admins table
  const { data: superadminCheck, error } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle()

  // If error or no data, user is not a superadmin
  return !error && !!superadminCheck
}

export async function getAllTenantsForSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Check if user has superadmin role
  const isSuperAdmin = await isUserSuperAdmin()
  if (!isSuperAdmin) return []

  const { data: tenants } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "active")
    .order("name")

  return tenants || []
}
