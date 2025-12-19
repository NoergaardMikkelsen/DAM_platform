import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  // Update Supabase session to sync cookies across subdomains
  const response = await updateSession(request)
  
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Remove port if present
  const [host] = hostname.split(':')

  // Debug logging
  console.log('[PROXY] Request:', { hostname, host, pathname })

  // CONTEXT DETECTION AND ROUTING

  // Tenant context: localhost subdomains for development (e.g., tenant.localhost)
  if (host.endsWith('.localhost') && !host.startsWith('admin.') && host !== 'localhost') {
    console.log('[PROXY] Tenant localhost detected:', host)
    // If root route on tenant subdomain, redirect to dashboard
    if (pathname === '/') {
      console.log('[PROXY] Redirecting root route to /dashboard')
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return response
  }

  // Tenant context: any subdomain of brandassets.space (excluding admin and main domain)
  if (host.endsWith('.brandassets.space') && !host.startsWith('admin.') && host !== 'brandassets.space') {
    // If root route on tenant subdomain, redirect to dashboard
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return response
  }

  // Public context: main domain
  if (host === 'brandassets.space' || host === 'localhost') {
    return response
  }

  // System admin context: admin subdomain (production)
  if (host === 'admin.brandassets.space') {
    return response
  }

  // System admin context: localhost development (admin.localhost)
  if (host === 'admin.localhost') {
    return response
  }

  // Default: allow all other routes
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (svg, png, jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
