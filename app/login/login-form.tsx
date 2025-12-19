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

      // Check what's in localStorage
      const localStorageKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-') || k.includes('auth'))
      const localStorageData = localStorageKeys.map(k => ({ key: k, hasValue: !!localStorage.getItem(k) }))
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-form.tsx:checkSession',message:'Checking existing session on page load',data:{hasSession:!!session,hasUser:!!session?.user,host:window.location.host,localStorageKeys:localStorageKeys,localStorageData:localStorageData,documentCookies:document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(n=>n.includes('sb-')||n.includes('auth'))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,G'})}).catch(()=>{});
      // #endregion

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
      debugLog.push(`[DEBUG] Attempting to sign in via API route...`)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-form.tsx:before-api-call',message:'About to call login API',data:{host:window.location.host},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Use API route to login and set cookies with correct domain
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important: include cookies
      })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login-form.tsx:after-api-call',message:'Login API response received',data:{status:loginResponse.status,ok:loginResponse.ok,host:window.location.host},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json()
        debugLog.push(`[DEBUG] API login error: ${errorData.error}`)
        console.error('[LOGIN DEBUG]', debugLog.join('\n'))

        if (errorData.error.includes('Invalid login credentials') || errorData.error.includes('Invalid')) {
          setError('Invalid email or password. Please check your credentials and try again.')
        } else if (errorData.error.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before logging in.')
        } else {
          setError(errorData.error)
        }
        setIsLoading(false)
        return
      }

      const loginData = await loginResponse.json()
      
      if (loginData?.user) {
        debugLog.push(`[DEBUG] API login successful, user: ${loginData.user.id}`)

        // Set session in Supabase client
        if (loginData.session) {
          await supabase.auth.setSession({
            access_token: loginData.session.access_token,
            refresh_token: loginData.session.refresh_token,
          })
        }

        // Determine redirect URL based on user context
        const redirectUrl = await determineUserRedirect(loginData.user.id, supabase, window.location.host)
        debugLog.push(`[DEBUG] Redirect URL determined: ${redirectUrl}`)

        console.log('[LOGIN DEBUG]', debugLog.join('\n'))

        if (redirectUrl) {
          // Small delay to ensure cookies are set
          await new Promise(resolve => setTimeout(resolve, 300))
          window.location.href = redirectUrl
        } else {
          // No valid access found, stay on login page with error
          setError('You do not have access to any tenants. Please contact your administrator.')
          setIsLoading(false)
          await supabase.auth.signOut()
        }
      } else {
        debugLog.push(`[DEBUG] API login successful but no user data`)
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

    // Check if user has superadmin role
    debugLog.push(`[REDIRECT] Checking if user is superadmin...`)
    const { data: superadminCheck, error: superadminError } = await supabase
      .from('client_users')
      .select(`
        id,
        roles!inner(key)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('roles.key', 'superadmin')
      .limit(1)

    if (superadminError) {
      debugLog.push(`[REDIRECT] Superadmin check error: ${superadminError.message}`)
    }

    if (superadminCheck && superadminCheck.length > 0) {
      debugLog.push(`[REDIRECT] User is superadmin, redirecting to /system-admin/dashboard`)
      return '/system-admin/dashboard'
    } else {
      debugLog.push(`[REDIRECT] User is not a superadmin`)
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
      // Check if user is superadmin (they have access to all tenants)
      debugLog.push(`[REDIRECT] Checking if user is superadmin...`)
      const { data: superadminCheck, error: superadminError } = await supabase
        .from("client_users")
        .select(`
          id,
          roles!inner(key)
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("roles.key", "superadmin")
        .limit(1)

      if (superadminError) {
        debugLog.push(`[REDIRECT] Superadmin check error: ${superadminError.message}`)
      }

      const isSuperAdmin = superadminCheck && superadminCheck.length > 0

      if (isSuperAdmin) {
        debugLog.push(`[REDIRECT] User is superadmin, has access to all tenants, redirecting to /dashboard`)
        return "/dashboard"
      }

      // Not a superadmin, check explicit tenant access
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

  // Priority: Superadmin > Any Tenant Access
  debugLog.push(`[REDIRECT] Checking if user is superadmin...`)
  const { data: superadminCheck, error: superadminError } = await supabase
    .from('client_users')
    .select(`
      id,
      roles!inner(key)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('roles.key', 'superadmin')
    .limit(1)

  if (superadminError) {
    debugLog.push(`[REDIRECT] Superadmin check error: ${superadminError.message}`)
  }

  if (superadminCheck && superadminCheck.length > 0) {
    debugLog.push(`[REDIRECT] User is superadmin, redirecting to /system-admin/dashboard`)
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
