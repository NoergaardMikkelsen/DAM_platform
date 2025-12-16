"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
      const redirectUrl = await determineUserRedirect(user.id, supabase)

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

/**
 * Determine correct redirect URL based on user context
 * Returns null if user has no valid access
 */
async function determineUserRedirect(userId: string, supabase: any): Promise<string | null> {
  // Check system admin access first (highest priority)
  const { data: systemAdmin } = await supabase
    .from("system_admins")
    .select("id")
    .eq("id", userId)
    .single()

  if (systemAdmin) {
    return "/system-admin/dashboard"
  }

  // Check client access (tenant user)
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select(`
      client_id,
      clients!inner(slug, domain)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)

  if (clientUsers && clientUsers.length > 0) {
    const client = clientUsers[0].clients

    // TODO: Implement tenant-aware redirects
    // Currently redirects to /dashboard regardless of current hostname
    // Future: Check current hostname and redirect to appropriate tenant subdomain
    // e.g., if on wrong subdomain, redirect to client.slug.domain.com/dashboard
    return "/dashboard"
  }

  // No valid access found
  return null
}
