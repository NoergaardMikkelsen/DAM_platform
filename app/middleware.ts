import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // Remove port if present
  const [host] = hostname.split(':')

  // CONTEXT DETECTION ONLY - Strict hostname pattern matching

  // Public context: main domain
  if (host === 'brandassets.space' || host === 'localhost') {
    return NextResponse.next()
  }

  // System admin context: admin subdomain
  if (host === 'admin.brandassets.space') {
    return NextResponse.next()
  }

  // Tenant context: any subdomain of brandassets.space (excluding admin)
  if (host.endsWith('.brandassets.space') && !host.startsWith('admin.')) {
    return NextResponse.next()
  }

  // Default: allow all other routes
  return NextResponse.next()
}


export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
