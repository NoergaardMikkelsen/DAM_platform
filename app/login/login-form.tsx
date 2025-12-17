"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, use } from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoginFormProps {
  currentHost: string
}

export function LoginForm({ currentHost }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = use(useSearchParams())

  // Check if we're on the wrong subdomain in development
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isWrongSubdomain = isDevelopment &&
    currentHost === 'localhost' &&
    !currentHost.includes('.localhost')

  // Detect context: system admin vs tenant
  const isSystemAdmin = currentHost === 'admin.brandassets.space' ||
    currentHost === 'admin.localhost' ||
    currentHost.startsWith('admin.localhost:')

  // Extract tenant slug from hostname for tenant context
  const getTenantSlug = () => {
    if (currentHost.endsWith('.brandassets.space')) {
      return currentHost.replace('.brandassets.space', '')
    }
    if (currentHost.includes('.localhost')) {
      return currentHost.split('.')[0]
    }
    return null
  }
  const tenantSlug = getTenantSlug()

  // Handle URL error parameters
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'access_denied') {
      setError("You don't have permission to access this area. Please contact your administrator.")
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const debugLog: string[] = []
    debugLog.push(`[DEBUG] Starting login process`)
    debugLog.push(`[DEBUG] Host: ${currentHost}`)
    debugLog.push(`[DEBUG] Email: ${email}`)

    // Debug Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    debugLog.push(`[DEBUG] Supabase URL: ${supabaseUrl ? 'configured' : 'MISSING'}`)
    debugLog.push(`[DEBUG] Supabase Anon Key: ${hasAnonKey ? 'configured' : 'MISSING'}`)

    if (!supabaseUrl || !hasAnonKey) {
      const errorMsg = 'Supabase configuration missing. Please check your .env.local file.'
      debugLog.push(`[DEBUG] ERROR: ${errorMsg}`)
      console.error('[LOGIN DEBUG]', debugLog.join('\n'))
      setError(errorMsg)
      setIsLoading(false)
      return
    }

    try {
      debugLog.push(`[DEBUG] Attempting to sign in with password...`)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        debugLog.push(`[DEBUG] Sign in error: ${signInError.message}`)
        debugLog.push(`[DEBUG] Error code: ${signInError.status || 'unknown'}`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))

        // Provide more helpful error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.')
        } else {
          setError(`${signInError.message}\n\nDebug info:\n${debugLog.join('\n')}`)
        }
        setIsLoading(false)
        return
      }

      debugLog.push(`[DEBUG] Sign in successful`)
      debugLog.push(`[DEBUG] Sign in data user ID: ${signInData?.user?.id || 'none'}`)
      debugLog.push(`[DEBUG] Sign in data session: ${signInData?.session ? 'present' : 'missing'}`)

      if (!signInData?.session) {
        debugLog.push(`[DEBUG] No session in sign in data`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))
        throw new Error("Authentication failed - no session returned")
      }

      debugLog.push(`[DEBUG] Getting user...`)
      const { data: { user }, error: getUserError } = await supabase.auth.getUser()

      if (getUserError) {
        debugLog.push(`[DEBUG] Get user error: ${getUserError.message}`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))
        throw getUserError
      }

      if (!user) {
        debugLog.push(`[DEBUG] No user returned from getUser()`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))
        throw new Error("Authentication failed - no user returned")
      }

      debugLog.push(`[DEBUG] User ID: ${user.id}`)
      debugLog.push(`[DEBUG] User email: ${user.email}`)

      // Sync session to server-side cookies via API route
      debugLog.push(`[DEBUG] Syncing session to server-side cookies...`)
      try {
        const syncResponse = await fetch('/api/auth/sync-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
          }),
        })

        if (!syncResponse.ok) {
          const errorData = await syncResponse.json()
          debugLog.push(`[DEBUG] Sync session error: ${errorData.error}`)
          console.warn('[LOGIN DEBUG]', debugLog.join('\n'))
          // Don't throw, continue anyway - cookies might still work
        } else {
          const syncData = await syncResponse.json()
          debugLog.push(`[DEBUG] Session synced successfully, ${syncData.cookiesSet} cookies set`)
        }
      } catch (syncError) {
        debugLog.push(`[DEBUG] Sync session exception: ${syncError instanceof Error ? syncError.message : 'Unknown'}`)
        console.warn('[LOGIN DEBUG]', debugLog.join('\n'))
        // Don't throw, continue anyway
      }

      // Determine user context and redirect appropriately
      debugLog.push(`[DEBUG] Determining redirect URL...`)
      const redirectUrl = await determineUserRedirect(user.id, supabase, currentHost, debugLog)

      debugLog.push(`[DEBUG] Redirect URL: ${redirectUrl || 'null'}`)

      if (!redirectUrl) {
        debugLog.push(`[DEBUG] No redirect URL found - user has no access`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))
        setError(`No access found. Please contact your administrator.\n\nDebug info:\n${debugLog.join('\n')}`)
        return
      }

      // Check if we need to redirect to a different host
      const redirectHost = redirectUrl.startsWith('http')
        ? new URL(redirectUrl).host
        : currentHost

      debugLog.push(`[DEBUG] Current host: ${currentHost}`)
      debugLog.push(`[DEBUG] Redirect host: ${redirectHost}`)

      // Always use window.location.href after login to ensure cookies are sent
      // router.push() doesn't send cookies to server-side rendering in Next.js App Router
      const fullRedirectUrl = redirectUrl.startsWith('http')
        ? redirectUrl
        : `${window.location.protocol}//${currentHost}${redirectUrl}`

      debugLog.push(`[DEBUG] Full redirect URL: ${fullRedirectUrl}`)
      console.log('[LOGIN DEBUG]', debugLog.join('\n'))

      // Use full page navigation to ensure cookies are sent with the request
      // Small delay to ensure cookies are set before redirect
      setTimeout(() => {
        window.location.href = fullRedirectUrl
      }, 100)

    } catch (error: unknown) {
      debugLog.push(`[DEBUG] Error caught: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('[LOGIN DEBUG]', debugLog.join('\n'))
      setError(`${error instanceof Error ? error.message : "An error occurred"}\n\nDebug info:\n${debugLog.join('\n')}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex min-h-screen w-full items-center justify-center p-6 ${isSystemAdmin ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Digital Asset Management</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            {isWrongSubdomain && (
              <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                <p className="font-medium">Note for local development:</p>
                <p>Please log in directly on the correct subdomain (e.g., admin.localhost:3000 or tenant.localhost:3000). Cookies don't share across localhost subdomains.</p>
              </div>
            )}
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-500 font-medium">{error.split('\n')[0]}</p>
                    {error.includes('[DEBUG]') && (
                      <details className="text-xs text-gray-600 bg-gray-50 p-2 rounded border max-h-60 overflow-auto">
                        <summary className="cursor-pointer font-medium">Debug Details</summary>
                        <pre className="mt-2 whitespace-pre-wrap">{error}</pre>
                      </details>
                    )}
                  </div>
                )}
                <Button type="submit" className={`w-full rounded-[25px] ${isSystemAdmin ? 'bg-black hover:bg-gray-800 text-white' : 'bg-[#DF475C] hover:bg-[#C82333]'}`} disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Determine correct redirect URL based on user context
 * Returns null if user has no valid access
 */
async function determineUserRedirect(userId: string, supabase: any, host: string, debugLog: string[] = []): Promise<string | null> {

  // CONTEXT-BASED REDIRECT LOGIC
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isLocalhost = host.includes('localhost')
  const port = host.includes(':') ? host.split(':')[1] : '3000'

  debugLog.push(`[REDIRECT] Host: ${host}`)
  debugLog.push(`[REDIRECT] Is development: ${isDevelopment}`)
  debugLog.push(`[REDIRECT] Is localhost: ${isLocalhost}`)
  debugLog.push(`[REDIRECT] Port: ${port}`)

  // 1. System Admin Context (admin.brandassets.space or admin.localhost)
  if (host === 'admin.brandassets.space' || host === 'admin.localhost' || host === (process.env.SYSTEM_ADMIN_HOST || `admin.localhost:${port}`)) {
    debugLog.push(`[REDIRECT] Checking system admin context...`)
    const { data: systemAdmin, error: systemAdminError } = await supabase
      .from("system_admins")
      .select("id")
      .eq("id", userId)
      .single()

    if (systemAdminError) {
      debugLog.push(`[REDIRECT] System admin query error: ${systemAdminError.message}`)
    }

    debugLog.push(`[REDIRECT] System admin result: ${systemAdmin ? 'found' : 'not found'}`)

    if (systemAdmin) {
      debugLog.push(`[REDIRECT] User is system admin, redirecting to /system-admin/dashboard`)
      return "/system-admin/dashboard"
    } else {
      // Not a system admin on admin subdomain - no access
      debugLog.push(`[REDIRECT] User is not a system admin on admin subdomain`)
      return null
    }
  }

  // 2. Tenant Context (*.brandassets.space or *.localhost excluding admin)
  if ((host.endsWith('.brandassets.space') && host !== 'admin.brandassets.space') ||
      (host.endsWith('.localhost') && host !== 'admin.localhost')) {
    const subdomain = host.endsWith('.brandassets.space')
      ? host.replace('.brandassets.space', '')
      : host.replace('.localhost', '').split(':')[0] // Remove port if present

    debugLog.push(`[REDIRECT] Checking tenant context...`)
    debugLog.push(`[REDIRECT] Extracted subdomain: ${subdomain}`)

    // Find the tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("clients")
      .select("id, slug, name")
      .eq("slug", subdomain)
      .eq("status", "active")
      .single()

    if (tenantError) {
      debugLog.push(`[REDIRECT] Tenant query error: ${tenantError.message}`)
    }

    debugLog.push(`[REDIRECT] Tenant result: ${tenant ? `found (id: ${tenant.id}, name: ${tenant.name})` : 'not found'}`)

    if (tenant) {
      // Check if user has access to this specific tenant
      debugLog.push(`[REDIRECT] Checking client_users access for tenant ${tenant.id}...`)
      const { data: accessCheck, error: accessError } = await supabase
        .from("client_users")
        .select("id, role_id")
        .eq("user_id", userId)
        .eq("client_id", tenant.id)
        .eq("status", "active")
        .single()

      if (accessError) {
        debugLog.push(`[REDIRECT] Client users query error: ${accessError.message}`)
      }

      debugLog.push(`[REDIRECT] Client users access result: ${accessCheck ? `found (id: ${accessCheck.id})` : 'not found'}`)

      if (accessCheck) {
        debugLog.push(`[REDIRECT] User has access to tenant, redirecting to /dashboard`)
        return "/dashboard"
      } else {
        debugLog.push(`[REDIRECT] User does not have access to this tenant`)
      }
    } else {
      debugLog.push(`[REDIRECT] Tenant not found with slug: ${subdomain}`)
    }
    // No access to this tenant
    return null
  }

  // 3. Public Context (brandassets.space) or other domains
  // Check what access the user has and redirect accordingly

  debugLog.push(`[REDIRECT] Checking public context...`)

  // Priority: System Admin > Any Tenant Access
  debugLog.push(`[REDIRECT] Checking if user is system admin...`)
  const { data: systemAdmin, error: systemAdminError } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", userId)
    .single()

  if (systemAdminError) {
    debugLog.push(`[REDIRECT] System admin query error: ${systemAdminError.message}`)
  }

  debugLog.push(`[REDIRECT] System admin result: ${systemAdmin ? 'found' : 'not found'}`)

  if (systemAdmin) {
    // System admin - redirect to system admin context
    debugLog.push(`[REDIRECT] User is system admin, redirecting to admin subdomain`)
    if (isDevelopment && isLocalhost) {
      return `http://admin.localhost:${port}/system-admin/dashboard`
    }
    return "https://admin.brandassets.space/system-admin/dashboard"
  }

  // Check for tenant access
  debugLog.push(`[REDIRECT] Checking for tenant access...`)
  const { data: clientUsers, error: clientUsersError } = await supabase
    .from("client_users")
    .select(`
      id,
      clients!inner(slug, domain, name)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)

  if (clientUsersError) {
    debugLog.push(`[REDIRECT] Client users query error: ${clientUsersError.message}`)
  }

  debugLog.push(`[REDIRECT] Client users result: ${clientUsers && clientUsers.length > 0 ? `found ${clientUsers.length} access(es)` : 'not found'}`)

  if (clientUsers && clientUsers.length > 0) {
    const client = clientUsers[0].clients
    debugLog.push(`[REDIRECT] User has access to tenant: ${client.slug} (${client.name})`)
    // Redirect to tenant subdomain
    if (isDevelopment && isLocalhost) {
      return `http://${client.slug}.localhost:${port}/dashboard`
    }
    return `https://${client.slug}.brandassets.space/dashboard`
  }

  // No valid access found
  debugLog.push(`[REDIRECT] No valid access found for user`)
  return null
}
