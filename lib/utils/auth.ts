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
