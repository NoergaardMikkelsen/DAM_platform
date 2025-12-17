import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  // Debug: Log cookies in development
  if (process.env.NODE_ENV === 'development') {
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('supabase') || 
      c.name.includes('sb-')
    )
    if (authCookies.length > 0) {
      console.log('[SERVER-SUPABASE] Found auth cookies:', authCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
    } else {
      console.log('[SERVER-SUPABASE] No auth cookies found. All cookies:', allCookies.map(c => c.name))
    }
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        const cookies = cookieStore.getAll()
        if (process.env.NODE_ENV === 'development') {
          const authCookies = cookies.filter(c => 
            c.name.includes('auth') || 
            c.name.includes('supabase') || 
            c.name.includes('sb-')
          )
          if (authCookies.length > 0) {
            console.log('[SERVER-SUPABASE] Reading auth cookies:', authCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
          }
        }
        return cookies
      },
      setAll(cookiesToSet) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('[SERVER-SUPABASE] Setting cookies:', cookiesToSet.map(c => ({ name: c.name, hasValue: !!c.value })))
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set cookies to be shareable across subdomains
            // Note: In development, browsers don't allow .localhost domain,
            // so cookies are host-specific. Users must log in on the correct subdomain.
            // In production, set domain to allow sharing across *.brandassets.space
            const cookieDomain = process.env.NODE_ENV === 'production' ? '.brandassets.space' : undefined
            const updatedOptions = {
              ...options,
              ...(cookieDomain && { domain: cookieDomain }),
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
