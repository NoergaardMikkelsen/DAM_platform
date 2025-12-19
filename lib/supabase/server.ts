import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  const allCookies = cookieStore.getAll()
  const authCookies = allCookies.filter(c =>
    c.name.includes('auth') ||
    c.name.includes('supabase') ||
    c.name.includes('sb-')
  )

  // #region agent log 
  fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:createClient',message:'Server client created',data:{authCookieCount:authCookies.length,authCookieNames:authCookies.map(c=>c.name),totalCookies:allCookies.length,hasAuthToken:authCookies.some(c=>c.name==='sb-auth-token')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        const cookies = cookieStore.getAll()
        return cookies
      },
      setAll(cookiesToSet) {
        try {
          // if (process.env.NODE_ENV === 'development') {
          //   console.log('[SERVER-SUPABASE] Setting cookies:', cookiesToSet.map(c => ({ name: c.name, hasValue: !!c.value })))
          // }
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
