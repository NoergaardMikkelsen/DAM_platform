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
        cookieOptions: {
          ...(process.env.NODE_ENV === 'production' && {
            domain: '.brandassets.space',
          }),
          path: '/',
          sameSite: (process.env.NODE_ENV === 'production' ? 'lax' : 'none') as any,
          secure: process.env.NODE_ENV === 'production',
        },
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
