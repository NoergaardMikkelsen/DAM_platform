import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Remove port if present
  const [host] = hostname.split(':')

  // Handle brandassets.space routing
  if (host === 'brandassets.space') {
    // Main domain - redirect to landing page if not already there
    if (!url.pathname.startsWith('/landing') && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next')) {
      return NextResponse.redirect(new URL('/landing', request.url))
    }
    return NextResponse.next()
  }

  if (host === 'admin.brandassets.space') {
    // Admin subdomain - redirect to system admin
    if (!url.pathname.startsWith('/system-admin')) {
      return NextResponse.redirect(new URL('/system-admin/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Handle other brandassets.space subdomains (tenants)
  if (host.endsWith('.brandassets.space')) {
    const subdomain = host.replace('.brandassets.space', '')

    if (subdomain && subdomain !== 'admin') {
      // This is a tenant subdomain - allow tenant routes
      return NextResponse.next()
    }
  }

  // Environment-driven system admin host (for localhost development)
  const systemAdminHost = process.env.SYSTEM_ADMIN_HOST || 'localhost:3000'
  if (hostname === systemAdminHost) {
    return NextResponse.next()
  }

  // Default: allow all other routes
  return NextResponse.next()
}

/**
 * Parse tenant subdomain from hostname
 * Returns null if not a tenant subdomain
 * Designed to work with staging/preview environments
 */
function parseTenantSubdomain(hostname: string): string | null {
  // Remove port if present
  const [host] = hostname.split(':')

  // Skip localhost/IP addresses during development
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null
  }

  // Skip system admin host - never treat as tenant
  const systemAdminHost = process.env.SYSTEM_ADMIN_HOST || 'localhost:3000'
  if (host === systemAdminHost) {
    return null
  }

  // Skip common preview/deployment hosts that aren't tenants
  const skipHosts = [
    'vercel.app',
    'netlify.app',
    'githubpreview.dev',
    'preview.app',
  ]

  if (skipHosts.some(skipHost => host.endsWith(skipHost))) {
    return null
  }

  // For tenant subdomains, require at least 3 parts
  // e.g., tenant.damsystem.com, tenant.staging.damsystem.com
  const parts = host.split('.')

  if (parts.length >= 3) {
    // Assume first part is tenant subdomain
    // This is temporary - will be validated against database later
    return parts[0]
  }

  return null
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
