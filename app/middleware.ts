import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Environment-driven system admin host
  const systemAdminHost = process.env.SYSTEM_ADMIN_HOST || 'localhost:3000'
  const systemAdminProtocol = process.env.SYSTEM_ADMIN_PROTOCOL || 'http'

  // If on system admin host, allow all routes
  if (hostname === systemAdminHost) {
    return NextResponse.next()
  }

  // Parse subdomain from tenant hosts
  const subdomain = parseTenantSubdomain(hostname)

  if (subdomain) {
    // On tenant subdomain - allow tenant routes, redirect system routes
    if (url.pathname.startsWith('/system-admin')) {
      // TODO: Implement tenant-aware system admin redirects
      // Currently redirects all system-admin routes to system admin host
      // Future: Check user permissions and redirect to appropriate tenant context
      const redirectUrl = `${systemAdminProtocol}://${systemAdminHost}${url.pathname}${url.search}`
      return NextResponse.redirect(redirectUrl)
    }

    // Allow tenant routes on subdomain
    return NextResponse.next()
  }

  // Default: treat as system admin host
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
