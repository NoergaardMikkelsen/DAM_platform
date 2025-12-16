import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: 'sb-auth-token',
        // Allow cookies to be shared across subdomains
        persistSession: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'brandassets-platform',
        },
      },
    }
  )

  return supabaseClient
}
