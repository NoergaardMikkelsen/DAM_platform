import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Handle favicon.ico requests and redirect to tenant-specific favicon
export async function GET(request: NextRequest) {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  
  // Extract tenant slug from hostname
  const hostWithoutPort = host.split(':')[0]
  let tenantSlug = null
  
  if (hostWithoutPort.endsWith('.brandassets.space')) {
    tenantSlug = hostWithoutPort.replace('.brandassets.space', '')
  } else if (hostWithoutPort.endsWith('.localhost')) {
    tenantSlug = hostWithoutPort.replace('.localhost', '')
  }
  
  // If no tenant subdomain, return 404 (let browser use default)
  if (!tenantSlug || tenantSlug === 'admin') {
    return new NextResponse(null, { status: 404 })
  }
  
  try {
    const supabase = await createClient()
    const { data: tenant } = await supabase
      .from('clients')
      .select('id, favicon_url, logo_url')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single()
    
    if (tenant) {
      const faviconUrl = tenant.favicon_url || tenant.logo_url
      if (faviconUrl) {
        // Redirect to the tenant's favicon with cache busting
        const cacheBuster = `${tenant.id}-${Date.now()}`
        const redirectUrl = `${faviconUrl}?v=${cacheBuster}`
        
        const response = NextResponse.redirect(redirectUrl, 302)
        // Add headers to prevent caching of the redirect
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        return response
      }
    }
  } catch (error) {
    // Silently fail - return 404 if favicon cannot be fetched
  }
  
  // No favicon found - return 404
  return new NextResponse(null, { status: 404 })
}

