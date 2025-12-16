import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
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
            supabaseResponse.cookies.set(name, value, updatedOptions)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if accessing protected routes without auth
  if (
    !user &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/assets") ||
      request.nextUrl.pathname.startsWith("/users") ||
      request.nextUrl.pathname.startsWith("/clients") ||
      request.nextUrl.pathname.startsWith("/tagging") ||
      request.nextUrl.pathname.startsWith("/profile"))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Redirect to dashboard if already logged in and accessing auth pages
  // But only if we're not on a system-admin subdomain (they should go to system-admin/dashboard)
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/sign-up")) {
    const host = request.headers.get('host') || ''
    const isSystemAdminHost = host === 'admin.brandassets.space' || host === 'admin.localhost' || host.startsWith('admin.localhost:')
    
    const url = request.nextUrl.clone()
    if (isSystemAdminHost) {
      url.pathname = "/system-admin/dashboard"
    } else {
      url.pathname = "/dashboard"
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
