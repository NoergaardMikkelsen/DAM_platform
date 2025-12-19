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
            // Use .localhost for development (modern browsers support this)
            // Use .brandassets.space for production
            const cookieDomain = process.env.NODE_ENV === 'production' ? '.brandassets.space' : '.localhost'
            const updatedOptions = {
              ...options,
              domain: cookieDomain,
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
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
