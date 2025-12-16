import type React from "react"
import { redirect } from "next/navigation"
import { headers as nextHeaders } from "next/headers"
import Head from "next/head"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"
import { createClient } from "@/lib/supabase/server"
import { BrandProvider } from "@/lib/context/brand-context"
import { TenantProvider } from "@/lib/context/tenant-context"

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verify user authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user data
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!userData) {
    redirect("/login")
  }

  // For now, skip tenant resolution during development to avoid headers issues
  // Resolve tenant from hostname
  let hostname = 'localhost:3000'
  try {
    const headersList = await nextHeaders()
    hostname = headersList?.get?.('host') || 'localhost:3000'
  } catch (error) {
    console.warn('Headers not available, using default hostname:', error)
  }

  let tenant = await resolveTenant(hostname, user.id, supabase)

  if (!tenant) {
    // For development without custom domains, create a fallback tenant
    // In production, this would redirect to login
    console.log('No tenant found, using development fallback (no custom domain setup yet)')
    tenant = {
      id: 'dev-tenant',
      name: 'Development Tenant',
      slug: 'dev',
      primaryColor: '#3b82f6',
      secondaryColor: '#1e40af',
      domain: null
    }
  }

  // Get user role within this tenant
  let role = null

  if (tenant.id !== 'dev-tenant') {
    // Only lookup role for real tenants
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

    role = clientUsers?.[0]?.roles?.key?.toLowerCase() || null
  } else {
    // For development, give admin role as fallback
    role = 'admin'
    console.log('Using admin role for development tenant')
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
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <SidebarVisibility>
            <Sidebar user={userData} role={role} />
          </SidebarVisibility>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </BrandProvider>
    </TenantProvider>
  )
}

/**
 * Resolve tenant from hostname and verify user access
 * Returns null if tenant cannot be resolved or user lacks access
 */
async function resolveTenant(hostname: string, userId: string, supabase: any): Promise<any | null> {
  // Parse subdomain (temporary implementation)
  const subdomain = parseTenantSubdomain(hostname)

  if (!subdomain) {
    // Not a tenant subdomain - no tenant context
    return null
  }

  // Lookup tenant in database
  const { data: tenant, error } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", subdomain)
    .eq("status", "active")
    .single()

  if (error || !tenant) {
    // Tenant not found or inactive
    return null
  }

  // Verify user has access to this tenant
  const { data: accessCheck } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", tenant.id)
    .eq("status", "active")
    .limit(1)

  if (!accessCheck || accessCheck.length === 0) {
    // User does not have access to this tenant
    return null
  }

  return tenant
}

/**
 * Parse tenant subdomain from hostname
 * Handles brandassets.space main domain and subdomains
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

  // Handle brandassets.space domains
  if (host === 'brandassets.space') {
    // Main domain - no tenant (public landing page)
    return null
  }

  if (host.endsWith('.brandassets.space')) {
    // Extract subdomain part (everything before .brandassets.space)
    const subdomain = host.replace('.brandassets.space', '')

    // Skip admin subdomain - goes to system admin, not tenant
    if (subdomain === 'admin') {
      return null
    }

    // Make sure it's not empty and doesn't contain dots (no nested subdomains for now)
    if (subdomain && !subdomain.includes('.')) {
      return subdomain
    }
  }

  // Skip other hosts that aren't brandassets.space
  return null
}
