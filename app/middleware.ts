import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTenantSubdomain, isSystemAdminSubdomain } from '@/lib/utils/hostname'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Remove port if present
  const [host] = hostname.split(':')

  // Debug logging - only in development for important paths
  if (process.env.NODE_ENV === 'development' &&
      (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/dashboard'))) {
    console.log('[MIDDLEWARE] Request:', { host, pathname })
  }

  // CONTEXT DETECTION AND ROUTING

  // Tenant context: redirect root to dashboard
  if (isTenantSubdomain(host)) {
    console.log('[MIDDLEWARE] Tenant subdomain detected:', host)
    if (pathname === '/') {
      console.log('[MIDDLEWARE] Redirecting root route to /dashboard')
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // System admin context
  if (isSystemAdminSubdomain(host)) {
    console.log('[MIDDLEWARE] System admin subdomain detected:', host)
    return NextResponse.next()
  }

  // Public context: main domain
  console.log('[MIDDLEWARE] Public/main domain detected:', host)
  return NextResponse.next()

  // Default: allow all other routes
  return NextResponse.next()
}


export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
