import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Remove port if present
  const [host] = hostname.split(':')

  // Debug logging
  console.log('[MIDDLEWARE] Request:', { hostname, host, pathname })

  // CONTEXT DETECTION AND ROUTING

  // Tenant context: localhost subdomains for development (e.g., tenant.localhost)
  if (host.endsWith('.localhost') && !host.startsWith('admin.')) {
    console.log('[MIDDLEWARE] Tenant localhost detected:', host)
    // If root route on tenant subdomain, redirect to dashboard
    if (pathname === '/') {
      console.log('[MIDDLEWARE] Redirecting root route to /dashboard')
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Tenant context: any subdomain of brandassets.space (excluding admin)
  if (host.endsWith('.brandassets.space') && !host.startsWith('admin.')) {
    // If root route on tenant subdomain, redirect to dashboard
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Public context: main domain
  if (host === 'brandassets.space' || host === 'localhost') {
    return NextResponse.next()
  }

  // System admin context: admin subdomain (production)
  if (host === 'admin.brandassets.space') {
    return NextResponse.next()
  }

  // System admin context: localhost development (admin.localhost)
  if (host === 'admin.localhost') {
    return NextResponse.next()
  }

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
