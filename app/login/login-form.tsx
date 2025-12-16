"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginForm({ isSystemAdmin = false }: { isSystemAdmin?: boolean }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirectTo = searchParams.get('redirect') || '/dashboard'

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // User is already logged in, redirect based on context
        const redirectUrl = await determineUserRedirect(session.user.id, supabase, window.location.host)
        if (redirectUrl) {
          // Use window.location for system admin redirects to ensure cookies are sent
          if (redirectUrl.startsWith('/system-admin')) {
            window.location.href = redirectUrl
          } else {
            router.push(redirectUrl)
          }
        } else {
          router.push('/dashboard')
        }
      }
    }

    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const debugLog: string[] = []
    debugLog.push(`[DEBUG] Starting login process`)
    debugLog.push(`[DEBUG] Host: ${window.location.host}`)
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
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))

        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before logging in.')
        } else {
          setError(signInError.message)
        }
        setIsLoading(false)
        return
      }

      if (signInData?.user) {
        debugLog.push(`[DEBUG] Sign in successful, user: ${signInData.user.id}`)

        // Determine redirect URL based on user context
        const redirectUrl = await determineUserRedirect(signInData.user.id, supabase, window.location.host)
        debugLog.push(`[DEBUG] Redirect URL determined: ${redirectUrl}`)

        console.log('[LOGIN DEBUG]', debugLog.join('\n'))

        if (redirectUrl) {
          // Use window.location.href for system admin redirects to ensure cookies are sent
          if (redirectUrl.startsWith('/system-admin')) {
            window.location.href = redirectUrl
          } else {
            router.push(redirectUrl)
          }
        } else {
          // No valid access found, stay on login page with error
          setError('You do not have access to any tenants. Please contact your administrator.')
          setIsLoading(false)
          await supabase.auth.signOut()
        }
      } else {
        debugLog.push(`[DEBUG] Sign in successful but no user data`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))
        setError('Login failed. Please try again.')
        setIsLoading(false)
      }
    } catch (err) {
      debugLog.push(`[DEBUG] Unexpected error: ${err}`)
      console.error('[LOGIN DEBUG]', debugLog.join('\n'))
      setError('An unexpected error occurred. Please try again.')
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
            <CardDescription>
              Enter your email below to login to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
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

  // 1. System Admin Context (admin.brandassets.space or admin.localhost*)
  if (host === 'admin.brandassets.space' || host === 'admin.localhost' || host.startsWith('admin.localhost:')) {
    debugLog.push(`[REDIRECT] System admin context detected`)

    // Check if user is a system admin
    debugLog.push(`[REDIRECT] Checking if user is system admin...`)
    const { data: systemAdminCheck, error: systemAdminError } = await supabase
      .from('system_admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (systemAdminError) {
      debugLog.push(`[REDIRECT] System admin check error: ${systemAdminError.message}`)
    }

    if (systemAdminCheck) {
      debugLog.push(`[REDIRECT] User is system admin, redirecting to /system-admin/dashboard`)
      return '/system-admin/dashboard'
    } else {
      debugLog.push(`[REDIRECT] User is not a system admin`)
      return null
    }
  }

  // 2. Tenant Context (*.brandassets.space or *.localhost)
  const isDevelopment = host.includes('localhost')
  const port = isDevelopment ? host.split(':')[1] || '3000' : null
  const isLocalhost = host.includes('localhost')

  let subdomain = ''
  if (isDevelopment && !isLocalhost) {
    // Development subdomain: subdomain.localhost:port
    subdomain = host.split('.')[0]
  } else if (!isDevelopment) {
    // Production subdomain: subdomain.brandassets.space
    if (host.endsWith('.brandassets.space')) {
      subdomain = host.replace('.brandassets.space', '')
    }
  } else {
    // Plain localhost - no subdomain
    subdomain = ''
  }

  debugLog.push(`[REDIRECT] Tenant context detected, subdomain: "${subdomain}"`)

  if (subdomain) {
    // Specific tenant requested
    debugLog.push(`[REDIRECT] Checking tenant access for subdomain: ${subdomain}...`)
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
  const { data: systemAdminCheck, error: systemAdminError } = await supabase
    .from('system_admins')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (systemAdminError) {
    debugLog.push(`[REDIRECT] System admin check error: ${systemAdminError.message}`)
  }

  if (systemAdminCheck) {
    debugLog.push(`[REDIRECT] User is system admin, redirecting to /system-admin/dashboard`)
    return '/system-admin/dashboard'
  }

  // Check for any tenant access
  debugLog.push(`[REDIRECT] Checking for any tenant access...`)
  const { data: clientUsers, error: clientUsersError } = await supabase
    .from("client_users")
    .select(`
      id,
      clients!inner (
        id,
        slug,
        name,
        status
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("clients.status", "active")

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

export { LoginForm }
