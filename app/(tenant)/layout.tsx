import type React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Head from "next/head"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"
import { createClient } from "@/lib/supabase/server"
import { extractTenantSubdomain } from "@/lib/utils/hostname"
import { BrandProvider } from "@/lib/context/brand-context"
import { TenantProvider } from "@/lib/context/tenant-context"
import { TenantLayoutClient } from "./layout-client"

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
    console.log('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))
    redirect("/system-admin/dashboard")
  }

  if (host === 'brandassets.space' || (isDevelopment && host === 'localhost')) {
    // Wrong context - redirect to public landing
    debugLog.push(`[TENANT-LAYOUT] Wrong context - redirecting to public landing`)
    console.log('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))
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
  const potentialSubdomain = extractTenantSubdomain(host)

  debugLog.push(`[TENANT-LAYOUT] Host: ${host}`)
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

  // TENANT ACCESS VALIDATION: Always check client_users table
  // System admins do NOT get automatic tenant access
  // Tenant access must be explicitly granted via client_users membership
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
  console.log('[TENANT-LAYOUT DEBUG]', debugLog.join('\n'))

  // Get user role within this tenant
  // System admin status does not affect tenant roles
  // Roles are always determined by explicit client_users membership
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
  const role = roleKey?.toLowerCase() || null

  // Apply tenant branding
  // Note: This sets CSS variables that BrandContext will use
  if (typeof window === 'undefined') {
    // Server-side: set CSS variables for initial render
    // Client-side BrandContext will handle updates
  }

  // Render tenant-scoped layout
  return (
    <TenantProvider tenant={tenant}>
      <BrandProvider>
        <Head>
          <title>{tenant.name} - Digital Asset Management</title>
          {tenant.logo_url ? (
            <>
              <link rel="icon" type="image/png" sizes="32x32" href={tenant.logo_url} />
              <link rel="icon" type="image/svg+xml" href={tenant.logo_url} />
              <link rel="apple-touch-icon" href={tenant.logo_url} />
            </>
          ) : (
            <>
              <link rel="icon" href="/icon-light-32x32.png" media="(prefers-color-scheme: light)" />
              <link rel="icon" href="/icon-dark-32x32.png" media="(prefers-color-scheme: dark)" />
              <link rel="icon" type="image/svg+xml" href="/icon.svg" />
              <link rel="apple-touch-icon" href="/apple-icon.png" />
            </>
          )}
        </Head>
        <TenantLayoutClient tenant={tenant} userData={userData} role={role}>
          {children}
        </TenantLayoutClient>
      </BrandProvider>
    </TenantProvider>
  )
}

