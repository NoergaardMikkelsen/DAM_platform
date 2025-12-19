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

  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  const incomingCookies = request.cookies.getAll()
  const authCookies = incomingCookies.filter(c => 
    c.name.includes('auth') || 
    c.name.includes('supabase') || 
    c.name.includes('sb-')
  )

  // Debug: Log incoming cookies in development (only for auth-related paths)
  if (process.env.NODE_ENV === 'development' && 
      (pathname.startsWith('/login') || pathname.startsWith('/api/auth'))) {
    if (authCookies.length > 0) {
      console.log('[PROXY] Incoming auth cookies:', authCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          const isProduction = process.env.NODE_ENV === 'production'
          
          // Create new response for setting cookies
          supabaseResponse = NextResponse.next({
            request,
          })
          
          cookiesToSet.forEach(({ name, value, options }) => {
            // For localhost: don't set domain (browser handles it)
            // For production: use .brandassets.space for cross-subdomain sharing
            // NOTE: httpOnly must be false for Supabase client-side to read session
            const updatedOptions = {
              ...(isProduction ? { domain: '.brandassets.space' } : {}),
              path: '/',
              httpOnly: false, // Must be false for client-side Supabase
              secure: isProduction,
              sameSite: 'lax' as const,
              // Preserve maxAge if provided, otherwise default to 7 days
              maxAge: options?.maxAge || 60 * 60 * 24 * 7,
            }
            
            // Debug: Log cookie setting in development
            if (!isProduction && (name.includes('auth') || name.includes('supabase') || name.includes('sb-'))) {
              console.log('[PROXY] Setting cookie:', { name, hasValue: !!value, maxAge: updatedOptions.maxAge })
            }
            
            // Delete old cookie first (if exists) to ensure clean state
            supabaseResponse.cookies.delete(name)
            // Set cookie with correct domain
            supabaseResponse.cookies.set(name, value, updatedOptions)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if this is an auth transfer request (cross-subdomain localhost workaround)
  const isAuthTransfer = request.nextUrl.searchParams.get('auth_transfer') === 'true'
  const accessToken = request.nextUrl.searchParams.get('access_token')
  const refreshToken = request.nextUrl.searchParams.get('refresh_token')
  const hasTransferTokens = !!(accessToken && refreshToken)

  // Handle auth transfer - set session cookies server-side
  if (isAuthTransfer && hasTransferTokens && !user) {
    try {
      // Set the session using transferred tokens
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      
      if (!sessionError && sessionData?.session) {
        // Session established! Now redirect to clean URL without tokens
        const cleanUrl = request.nextUrl.clone()
        cleanUrl.searchParams.delete('auth_transfer')
        cleanUrl.searchParams.delete('access_token')
        cleanUrl.searchParams.delete('refresh_token')
        
        return NextResponse.redirect(cleanUrl)
      } else {
        console.error('[PROXY] Auth transfer failed:', sessionError)
      }
    } catch (err) {
      console.error('[PROXY] Auth transfer error:', err)
    }
  }

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
