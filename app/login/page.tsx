"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Authentication failed")

      // Determine user context and redirect appropriately
      const redirectUrl = await determineUserRedirect(user.id, supabase, window.location.host)

      if (!redirectUrl) {
        setError("No access found. Please contact your administrator.")
        return
      }

      router.push(redirectUrl)

    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">nørgård mikkelsen</h1>
          <p className="mt-2 text-sm text-gray-600">Digital Asset Management</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>Enter your email below to login to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]" disabled={isLoading}>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">nørgård mikkelsen</h1>
            <p className="mt-2 text-sm text-gray-600">Digital Asset Management</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Login</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

/**
 * Determine correct redirect URL based on user context
 * Returns null if user has no valid access
 */
async function determineUserRedirect(userId: string, supabase: any, host: string): Promise<string | null> {

  // CONTEXT-BASED REDIRECT LOGIC

  // 1. System Admin Context (admin.brandassets.space)
  if (host === 'admin.brandassets.space' || host === (process.env.SYSTEM_ADMIN_HOST || 'localhost:3000')) {
    const { data: systemAdmin } = await supabase
      .from("system_admins")
      .select("id")
      .eq("id", userId)
      .single()

    if (systemAdmin) {
      return "/system-admin/dashboard"
    } else {
      // Not a system admin on admin subdomain - no access
      return null
    }
  }

  // 2. Tenant Context (*.brandassets.space excluding admin)
  if (host.endsWith('.brandassets.space') && host !== 'admin.brandassets.space') {
    const subdomain = host.replace('.brandassets.space', '')

    // Find the tenant
    const { data: tenant } = await supabase
      .from("clients")
      .select("id")
      .eq("slug", subdomain)
      .eq("status", "active")
      .single()

    if (tenant) {
      // Check if user has access to this specific tenant
      const { data: accessCheck } = await supabase
        .from("client_users")
        .select("id")
        .eq("user_id", userId)
        .eq("client_id", tenant.id)
        .eq("status", "active")
        .single()

      if (accessCheck) {
        return "/dashboard"
      }
    }
    // No access to this tenant
    return null
  }

  // 3. Public Context (brandassets.space) or other domains
  // Check what access the user has and redirect accordingly

  // Priority: System Admin > Any Tenant Access
  const { data: systemAdmin } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", userId)
    .single()

  if (systemAdmin) {
    // System admin - redirect to system admin context
    return "https://admin.brandassets.space/system-admin/dashboard"
  }

  // Check for tenant access
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select(`
      clients!inner(slug, domain)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)

  if (clientUsers && clientUsers.length > 0) {
    const client = clientUsers[0].clients
    // Redirect to tenant subdomain
    return `https://${client.slug}.brandassets.space/dashboard`
  }

  // No valid access found
  return null
}
