import type React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Head from "next/head"
import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BrandProvider } from "@/lib/context/brand-context"
import { TenantProvider } from "@/lib/context/tenant-context"
import { SessionSyncProvider } from "@/components/session-sync-provider"
import TenantLayoutClient from "./layout-client"

export async function generateMetadata({ params }: { params: { tenant?: string } }): Promise<Metadata> {
  // Get tenant from URL params or extract from hostname
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isLocalhost = host.includes('localhost')

  let tenantSlug = params.tenant

  // Extract tenant slug from hostname if not in params
  if (!tenantSlug) {
    const hostWithoutPort = host.split(':')[0]
    if (hostWithoutPort.endsWith('.brandassets.space')) {
      tenantSlug = hostWithoutPort.replace('.brandassets.space', '')
    } else if (hostWithoutPort.endsWith('.localhost')) {
      tenantSlug = hostWithoutPort.replace('.localhost', '')
    }
  }

  // Fetch tenant data for metadata
  if (tenantSlug && tenantSlug !== 'admin') {
    try {
      const supabase = await createClient()
      const { data: tenant } = await supabase
        .from("clients")
        .select("name, logo_url, favicon_url, logo_collapsed_url")
        .eq("slug", tenantSlug)
        .eq("status", "active")
        .single()

      if (tenant) {
        return {
          title: `${tenant.name} - Digital Asset Management`,
          icons: {
            icon: tenant.favicon_url || tenant.logo_url || "/logo/favicon/favicon-16x16.png",
            apple: tenant.favicon_url || tenant.logo_url || "/apple-icon.png",
          },
        }
      }
    } catch (error) {
      console.error('Error fetching tenant metadata:', error)
    }
  }

  // Fallback metadata
  return {
    title: "Digital Asset Management",
    icons: {
      icon: "/logo/favicon/favicon-16x16.png",
      apple: "/apple-icon.png",
    },
  }
}

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode
}) {
  const debugLog: string[] = []
  debugLog.push(`[TENANT-LAYOUT] Starting layout check`)
  
  const supabase = await createClient()
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const protocol = headersList.get('x-forwarded-proto') || 'http'

  debugLog.push(`[TENANT-LAYOUT] Host: ${host}`)
  debugLog.push(`[TENANT-LAYOUT] Protocol: ${protocol}`)

  // CONTEXT RESOLUTION: Only allow tenant subdomains in this layout
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isLocalhost = host.includes('localhost')

  debugLog.push(`[TENANT-LAYOUT] Is development: ${isDevelopment}`)
  debugLog.push(`[TENANT-LAYOUT] Is localhost: ${isLocalhost}`)

  // Admin subdomain should NEVER reach tenant layout - redirect immediately
  if (host === 'admin.brandassets.space' || host === 'admin.localhost' || host.startsWith('admin.localhost:')) {
    debugLog.push(`[TENANT-LAYOUT] Admin subdomain detected - redirecting to system-admin`)
    redirect("/system-admin/dashboard")
  }

  if (host === 'brandassets.space' || (isDevelopment && host === 'localhost')) {
    // Wrong context - redirect to public landing
    debugLog.push(`[TENANT-LAYOUT] Wrong context - redirecting to public landing`)
    redirect("/")
  }

  // Verify user authentication
  debugLog.push(`[TENANT-LAYOUT] Checking user authentication...`)
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError) {
    debugLog.push(`[TENANT-LAYOUT] Get user error: ${userError.message}`)
  }

  debugLog.push(`[TENANT-LAYOUT] User: ${user ? `found (id: ${user.id})` : 'not found'}`)

  if (!user) {
    debugLog.push(`[TENANT-LAYOUT] No user - redirecting to login`)
    console.error('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))
    redirect("/login")
  }

  // TENANT IDENTIFICATION: Parse hostname and lookup tenant in database

  // Extract potential tenant subdomain from hostname
  // First, remove port if present
  const hostWithoutPort = host.split(':')[0]
  let potentialSubdomain = null

  if (hostWithoutPort.endsWith('.brandassets.space')) {
    potentialSubdomain = hostWithoutPort.replace('.brandassets.space', '')
  } else if (hostWithoutPort.endsWith('.localhost')) {
    // Development fallback for localhost subdomains (handles any port)
    potentialSubdomain = hostWithoutPort.replace('.localhost', '')
  }

  debugLog.push(`[TENANT-LAYOUT] Host without port: ${hostWithoutPort}`)
  debugLog.push(`[TENANT-LAYOUT] Potential subdomain: ${potentialSubdomain || 'null'}`)

  // Skip invalid subdomains (empty, admin, www, etc.)
  if (!potentialSubdomain || potentialSubdomain === 'admin' || potentialSubdomain === 'www' || potentialSubdomain === '') {
    debugLog.push(`[TENANT-LAYOUT] Invalid subdomain - redirecting`)
    console.error('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))
    // Don't redirect admin subdomains - let them be handled by system-admin routing
    if (hostWithoutPort === 'admin.brandassets.space' || hostWithoutPort === 'admin.localhost') {
      debugLog.push(`[TENANT-LAYOUT] Admin subdomain detected - this should not happen, redirecting to system-admin`)
      redirect("/system-admin/dashboard")
    }
    if (isDevelopment && isLocalhost) {
      redirect("http://localhost/")
    }
    redirect("https://brandassets.space/")
  }

  // Lookup tenant by slug in database
  debugLog.push(`[TENANT-LAYOUT] Looking up tenant with slug: ${potentialSubdomain}`)
  const { data: tenant, error: tenantError } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", potentialSubdomain)
    .eq("status", "active")
    .single()

  if (tenantError) {
    debugLog.push(`[TENANT-LAYOUT] Tenant query error: ${tenantError.message}`)
  }

  debugLog.push(`[TENANT-LAYOUT] Tenant result: ${tenant ? `found (id: ${tenant.id}, name: ${tenant.name})` : 'not found'}`)

  if (!tenant) {
    // No tenant found with this slug - redirect to main site
    debugLog.push(`[TENANT-LAYOUT] Tenant not found - redirecting`)
    console.error('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))
    // Don't redirect admin subdomains - let them be handled by system-admin routing
    if (hostWithoutPort === 'admin.brandassets.space' || hostWithoutPort === 'admin.localhost') {
      debugLog.push(`[TENANT-LAYOUT] Admin subdomain detected - this should not happen, redirecting to system-admin`)
      redirect("/system-admin/dashboard")
    }
    if (isDevelopment && isLocalhost) {
      redirect("http://localhost/")
    }
    redirect("https://brandassets.space/")
  }

  // TENANT ACCESS VALIDATION: Check if user has access to this tenant
  // Superadmins get automatic access to all tenants (via superadmin role in any client)
  // Other users need explicit client_users membership for this specific tenant
  
  // First check if user is superadmin
  const { data: superadminCheck } = await supabase
    .from("client_users")
    .select(`
      id,
      roles!inner(key)
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("roles.key", "superadmin")
    .limit(1)

  const isSuperAdmin = superadminCheck && superadminCheck.length > 0

  if (!isSuperAdmin) {
    // Not a superadmin, check explicit tenant access
    const { data: accessCheck } = await supabase
      .from("client_users")
      .select("id, role_id")
      .eq("user_id", user.id)
      .eq("client_id", tenant.id)
      .eq("status", "active")
      .single()

    if (!accessCheck) {
      // No access to this tenant - redirect to login
      redirect("/login")
    }
  }

  // Get user data
  debugLog.push(`[TENANT-LAYOUT] Getting user data...`)
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (userDataError) {
    debugLog.push(`[TENANT-LAYOUT] User data query error: ${userDataError.message}`)
  }

  debugLog.push(`[TENANT-LAYOUT] User data result: ${userData ? 'found' : 'not found'}`)

  if (!userData) {
    debugLog.push(`[TENANT-LAYOUT] No user data - redirecting to login`)
    console.error('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))
    redirect("/login")
  }

  debugLog.push(`[TENANT-LAYOUT] All checks passed - rendering layout`)

  // Get user role within this tenant
  // Superadmins always get "superadmin" role
  // Other users get their role from explicit client_users membership
  let role: string | null = null
  
  if (isSuperAdmin) {
    role = "superadmin"
  } else {
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select(`
        role_id,
        roles!inner(key)
      `)
      .eq("user_id", user.id)
      .eq("client_id", tenant.id)
      .eq("status", "active")
      .limit(1)

    const roleEntry = clientUsers?.[0]?.roles as { key?: string } | { key?: string }[] | null | undefined
    const roleKey = Array.isArray(roleEntry) ? roleEntry[0]?.key : roleEntry?.key
    role = roleKey?.toLowerCase() || null
  }

  // Apply tenant branding
  // Note: This sets CSS variables that BrandContext will use
  if (typeof window === 'undefined') {
    // Server-side: set CSS variables for initial render
    // Client-side BrandContext will handle updates
  }

  // Render tenant-scoped layout with loading screen
  return (
    <TenantProvider tenant={tenant}>
      <BrandProvider>
        <SessionSyncProvider>
          <Head>
            <title>{tenant.name} - Digital Asset Management</title>
          </Head>
          <TenantLayoutClient
            tenant={tenant}
            userData={userData}
            role={role}
          >
            {children}
          </TenantLayoutClient>
        </SessionSyncProvider>
      </BrandProvider>
    </TenantProvider>
  )
}

