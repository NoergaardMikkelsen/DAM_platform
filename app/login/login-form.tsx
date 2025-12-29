"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { Mail, Lock } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Tenant branding interface
interface TenantBranding {
  name: string
  logo_url?: string
  primary_color: string
}

function LoginForm({
  isSystemAdmin = false,
  tenant: serverTenant
}: {
  isSystemAdmin?: boolean
  tenant?: TenantBranding | null
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [tenant, setTenant] = useState<TenantBranding | null>(serverTenant || null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentHostname, setCurrentHostname] = useState<string>('')

  const redirectTo = searchParams.get('redirect') || '/dashboard'
  
  // Client-side fallback: detect admin subdomain from window.location
  // This ensures correct styling even if server-side prop isn't passed correctly
  const [clientIsSystemAdmin, setClientIsSystemAdmin] = useState(isSystemAdmin)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const isAdmin = host === 'admin.brandassets.space' || host === 'admin.localhost' || host.startsWith('admin.localhost')
      setClientIsSystemAdmin(isAdmin)
      
      // Track hostname changes to reset error when switching tenants
      if (host !== currentHostname) {
        setCurrentHostname(host)
        // Clear error when hostname changes (tenant switch)
        setError(null)
        
        // Remove error parameter from URL when switching tenants
        const url = new URL(window.location.href)
        if (url.searchParams.has('error')) {
          url.searchParams.delete('error')
          // Replace URL without reload to remove error parameter
          window.history.replaceState({}, '', url.toString())
        }
      }
    }
  }, [currentHostname])
  
  // Use client-side detection if server-side prop is false but we're on admin subdomain
  const effectiveIsSystemAdmin = isSystemAdmin || clientIsSystemAdmin

  // Detect tenant from subdomain and load branding (fallback if server didn't provide)
  useEffect(() => {
    // If we already have tenant data from server, don't fetch again
    if (serverTenant) return

    const loadTenantBranding = async () => {
      if (typeof window !== 'undefined') {
        const host = window.location.hostname

        // Skip admin subdomains
        if (host === 'admin.brandassets.space' || host === 'admin.localhost' || host.startsWith('admin.localhost')) {
          return
        }

        // Extract tenant slug from subdomain
        let tenantSlug = null
        if (host.endsWith('.brandassets.space')) {
          tenantSlug = host.replace('.brandassets.space', '')
        } else if (host.endsWith('.localhost')) {
          tenantSlug = host.replace('.localhost', '')
        }


        if (tenantSlug && tenantSlug !== 'www') {
          try {
            const supabase = createClient()

            // Try multiple possible slug variations
            const possibleSlugs = [tenantSlug, `${tenantSlug}-demo`, `norgard-mikkelsen`]

            let tenantData = null

            for (const slug of possibleSlugs) {
              const { data, error } = await supabase
                .from("clients")
                .select("name, logo_url, primary_color")
                .eq("slug", slug)
                .eq("status", "active")
                .single()

              if (data && !error) {
                tenantData = data
                break
              }
            }

            if (tenantData) {
              setTenant(tenantData)
            }
          } catch (error) {
            console.error('[LOGIN] Failed to load tenant branding:', error)
          }
        }
      }
    }

    loadTenantBranding()
  }, [serverTenant])


  useEffect(() => {
    const checkSession = async () => {
      // Check for error parameter in URL
      const errorParam = searchParams.get('error')
      if (errorParam === 'no_access') {
        setError('You do not have access to this tenant. Please contact your administrator.')
        return
      }

      // If no error parameter, clear any existing error and remove from URL if present
      if (!errorParam) {
        setError(null)
        // Also remove error parameter from URL if it exists (cleanup)
        if (typeof window !== 'undefined' && window.location.search.includes('error=')) {
          const url = new URL(window.location.href)
          url.searchParams.delete('error')
          window.history.replaceState({}, '', url.toString())
        }
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // Check what's in localStorage
      const localStorageKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-') || k.includes('auth'))
      const localStorageData = localStorageKeys.map(k => ({ key: k, hasValue: !!localStorage.getItem(k) }))

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
          // User doesn't have access to current tenant - don't redirect, show error
          setError('You do not have access to this tenant. Please contact your administrator.')
        }
      }
    }

    checkSession()
  }, [router, searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !hasAnonKey) {
      setError('Supabase configuration missing. Please check your .env.local file.')
      setIsLoading(false)
      return
    }

    try {
      // Use API route to login and set cookies with correct domain
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important: include cookies
      })

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json()

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
        // Set session in Supabase client
        if (loginData.session) {
          await supabase.auth.setSession({
            access_token: loginData.session.access_token,
            refresh_token: loginData.session.refresh_token,
          })
        }

        // Simple redirect logic:
        // - If on tenant subdomain (nmic.localhost), go to /dashboard
        // - If on admin subdomain (admin.localhost), go to /system-admin/dashboard
        // - Otherwise, let the server-side layout handle authorization
        const host = window.location.hostname
        const isAdminSubdomain = host === 'admin.localhost' || host === 'admin.brandassets.space'
        const isTenantSubdomain = (host.endsWith('.localhost') && host !== 'localhost' && !isAdminSubdomain) ||
                                   (host.endsWith('.brandassets.space') && host !== 'brandassets.space' && !isAdminSubdomain)

        let redirectUrl = '/dashboard'
        if (isAdminSubdomain) {
          redirectUrl = '/system-admin/dashboard'
        }

        // Small delay to ensure cookies are set
        await new Promise(resolve => setTimeout(resolve, 300))
        window.location.href = redirectUrl
      } else {
        setError('Login failed. Please try again.')
        setIsLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-6 ${
      effectiveIsSystemAdmin ? 'bg-gray-50' : 'bg-gray-50'
    }`}>
        {/* Main content */}
        <div className="w-full max-w-md">
        <div className="w-full max-w-md">
          {/* Clean Login Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header with Logo */}
            <div className="px-8 pt-8 pb-4 text-center">
              {tenant?.logo_url ? (
                <div className="mb-6">
                  <img
                    src={tenant.logo_url}
                    alt={`${tenant.name} Logo`}
                    className="h-12 mx-auto object-contain"
                  />
                </div>
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                  {tenant?.name || 'Digital Asset Management'}
                </h1>
              )}
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {tenant ? `Login to ${tenant.name} DAM` : 'Login'}
              </h2>
              <p className="text-gray-600 text-sm">
                Enter your credentials to continue
              </p>
            </div>

            {/* Form Content */}
            <div className="px-8 py-6">
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700">{error.split('\n')[0]}</p>
                    {error.includes('[DEBUG]') && (
                      <details className="mt-3 text-xs text-red-600 bg-red-100 p-3 rounded border max-h-32 overflow-auto">
                        <summary className="cursor-pointer font-medium">Debug Details</summary>
                        <pre className="mt-2 whitespace-pre-wrap">{error}</pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Login Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-lg font-medium text-white hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: effectiveIsSystemAdmin ? '#000000' : (tenant?.primary_color || '#DF475C')
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Login'
                  )}
                </Button>

                {/* Footer */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-xs text-gray-500 text-center">
                    <span className="font-semibold text-gray-700">Nørgård Mikkelsen</span>
                    {' '}Digital Asset Management System
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Determine correct redirect URL based on user context
 * Returns null if user has no valid access
 */
async function determineUserRedirect(userId: string, supabase: any, host: string): Promise<string | null> {

  // CONTEXT-BASED REDIRECT LOGIC

  // 1. System Admin Context (admin.brandassets.space or admin.localhost*)
  if (host === 'admin.brandassets.space' || host === 'admin.localhost' || host.startsWith('admin.localhost:')) {
    // Check if user has superadmin role
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

    if (superadminCheck && superadminCheck.length > 0) {
      return '/system-admin/dashboard'
    }
    return null
  }

  // 2. Tenant Context (*.brandassets.space or *.localhost)
  const hostWithoutPort = host.split(':')[0]
  const port = host.split(':')[1] || '3000'

  let subdomain = ''

  // Check for localhost subdomains (e.g., nmic.localhost:3000)
  if (hostWithoutPort.endsWith('.localhost') && hostWithoutPort !== 'localhost') {
    subdomain = hostWithoutPort.replace('.localhost', '')
  }
  // Check for production subdomains (e.g., nmic.brandassets.space)
  else if (hostWithoutPort.endsWith('.brandassets.space') && hostWithoutPort !== 'brandassets.space') {
    subdomain = hostWithoutPort.replace('.brandassets.space', '')
  }

  const isDevelopment = hostWithoutPort.includes('localhost')

  if (subdomain) {
    // Specific tenant requested
    const { data: tenant, error: tenantError } = await supabase
      .from("clients")
      .select("id, slug, name")
      .eq("slug", subdomain)
      .eq("status", "active")
      .single()

    if (tenant) {
      // Check if user is superadmin (they have access to all tenants)
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

      const isSuperAdmin = superadminCheck && superadminCheck.length > 0

      if (isSuperAdmin) {
        return "/dashboard"
      }

      // Not a superadmin, check explicit tenant access
      // Use maybeSingle() instead of single() to avoid 406 error when no access
      const { data: accessCheck, error: accessError } = await supabase
        .from("client_users")
        .select("id, role_id")
        .eq("user_id", userId)
        .eq("client_id", tenant.id)
        .eq("status", "active")
        .maybeSingle()

      if (accessCheck && !accessError) {
        return "/dashboard"
      }
    }
    // No access to this tenant
    return null
  }

  // 3. Public Context (brandassets.space) or other domains
  // Check what access the user has and redirect accordingly

  // Priority: Superadmin > Any Tenant Access
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

  if (superadminCheck && superadminCheck.length > 0) {
    return '/system-admin/dashboard'
  }

  // Check for any tenant access
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

  if (clientUsers && clientUsers.length > 0) {
    const client = clientUsers[0].clients
    // Redirect to tenant subdomain
    if (isDevelopment) {
      return `http://${client.slug}.localhost:${port}/dashboard`
    }
    return `https://${client.slug}.brandassets.space/dashboard`
  }

  // No valid access found
  return null
}

export { LoginForm }
