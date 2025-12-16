import type React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
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
  const headersList = await headers()
  const host = headersList.get('host') || ''

  // CONTEXT RESOLUTION: Only allow tenant subdomains in this layout
  if (host === 'brandassets.space') {
    // Wrong context - redirect to public landing
    redirect("/")
  }

  // Admin subdomain should not reach this layout - handled by file structure
  if (host === 'admin.brandassets.space') {
    // This shouldn't happen due to Next.js routing, but just in case
    redirect("/system-admin/dashboard")
  }

  // Verify user authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // TENANT IDENTIFICATION: Parse hostname and lookup tenant in database

  // Extract potential tenant subdomain from hostname
  let potentialSubdomain = null

  if (host.endsWith('.brandassets.space')) {
    potentialSubdomain = host.replace('.brandassets.space', '')
  } else if (host.endsWith('.localhost:3001')) {
    // Development fallback for localhost subdomains
    potentialSubdomain = host.replace('.localhost:3001', '')
  }

  // Skip invalid subdomains (empty, admin, www, etc.)
  if (!potentialSubdomain || potentialSubdomain === 'admin' || potentialSubdomain === 'www' || potentialSubdomain === '') {
    redirect("https://brandassets.space/")
  }

  // Lookup tenant by slug in database
  const { data: tenant } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", potentialSubdomain)
    .eq("status", "active")
    .single()

  if (!tenant) {
    // No tenant found with this slug - redirect to main site
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
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!userData) {
    redirect("/login")
  }

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
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <SidebarVisibility>
            <Sidebar user={userData} role={role || undefined} />
          </SidebarVisibility>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </BrandProvider>
    </TenantProvider>
  )
}

