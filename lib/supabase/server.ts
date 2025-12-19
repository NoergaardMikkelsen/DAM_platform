import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  const allCookies = cookieStore.getAll()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        const cookies = cookieStore.getAll()
        return cookies
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set cookies to be shareable across subdomains
            // For localhost: don't set domain (browser handles it)
            // For production: use .brandassets.space
            // NOTE: httpOnly must be false for Supabase client-side to read session
            const isProduction = process.env.NODE_ENV === 'production'
            const updatedOptions = {
              ...options,
              ...(isProduction ? { domain: '.brandassets.space' } : {}),
              path: '/',
              httpOnly: false, // Must be false for client-side Supabase
              secure: isProduction,
              sameSite: 'lax' as const,
            }
            cookieStore.set(name, value, updatedOptions)
          })
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have proxy refreshing
          // user sessions.
        }
      },
    },
  })
}

export { createClient as createServerClient }
