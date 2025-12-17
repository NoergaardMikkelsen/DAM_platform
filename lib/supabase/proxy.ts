import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSystemAdminSubdomain } from "@/lib/utils/hostname"

export async function updateSession(request: NextRequest) {
  // Only log in development and for auth-related paths to reduce noise
  if (process.env.NODE_ENV === 'development' &&
      (request.nextUrl.pathname.startsWith('/login') ||
       request.nextUrl.pathname.startsWith('/api/auth'))) {
    console.log('[PROXY] Processing request:', {
      pathname: request.nextUrl.pathname,
      host: request.headers.get('host')
    })
  }

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

  // Allow authenticated users to access login pages for tenant switching
  // Only redirect away from login if we're on the main domain (brandassets.space/localhost)
  // This allows users to switch between tenants by visiting tenant login pages
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/sign-up")) {
    const host = request.headers.get('host') || ''
    const isMainDomain = host === 'brandassets.space' || host === 'localhost' ||
                        (host === 'localhost:3000') // Development

    // Only redirect on main domain - allow tenant-specific login access for switching
    if (isMainDomain) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard" // Redirect to public dashboard (will redirect to best tenant)
      return NextResponse.redirect(url)
    }
    // On tenant/system-admin subdomains, allow access to login page for tenant switching
  }

  return supabaseResponse
}
