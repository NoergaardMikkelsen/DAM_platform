"use server"

import { createClient } from "@supabase/supabase-js"

interface UserWithRole {
  id: string
  status: string
  created_at: string
  roles: {
    name: string
    key: string
  } | null
  users: {
    id: string
    full_name: string
    email: string
  } | null
}

export async function getTenantUsers(clientId: string): Promise<UserWithRole[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get ALL client_users for this tenant
  const { data: clientUsers, error: clientUsersError } = await supabase
    .from("client_users")
    .select("id, user_id, role_id, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  if (clientUsersError || !clientUsers) {
    console.error('[TENANT-USERS-ACTIONS] Error fetching client_users:', clientUsersError)
    return []
  }


  // Get all user IDs and role IDs
  const userIds = [...new Set(clientUsers.map(cu => cu.user_id))]
  const roleIds = [...new Set(clientUsers.map(cu => cu.role_id))]

  // Fetch users data
  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", userIds)

  // Fetch roles data
  const { data: rolesData, error: rolesError } = await supabase
    .from("roles")
    .select("id, name, key")
    .in("id", roleIds)

  if (usersError) console.error('[TENANT-USERS-ACTIONS] Error fetching users:', usersError)
  if (rolesError) console.error('[TENANT-USERS-ACTIONS] Error fetching roles:', rolesError)

  // Create lookup maps
  const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])
  const rolesMap = new Map(rolesData?.map(r => [r.id, r]) || [])

  // Combine data
  const result = clientUsers.map(clientUser => ({
    id: clientUser.id,
    status: clientUser.status,
    created_at: clientUser.created_at,
    roles: rolesMap.get(clientUser.role_id) || null,
    users: usersMap.get(clientUser.user_id) || null
  }))

  return result
}
