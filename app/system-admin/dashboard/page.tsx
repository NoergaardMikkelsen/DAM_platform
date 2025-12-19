"use client"

import { createClient } from "@/lib/supabase/client"
import { getAllTenantsForSuperAdmin } from "./actions"
import { Settings, ArrowRight, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { DashboardHeaderSkeleton, StatsGridSkeleton } from "@/components/skeleton-loaders"
import { syncSessionAcrossSubdomains } from "@/lib/utils/session-sync"

interface SystemStats {
  totalClients: number
  activeClients: number
  totalUsers: number
  totalStorageGB: number
  recentActivity: Array<{
    id: string
    action: string
    timestamp: string
  }>
}

export default function SystemAdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [tenants, setTenants] = useState<Array<{id: string, name: string, slug: string}> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTenants, setIsLoadingTenants] = useState(true)
  const [tenantError, setTenantError] = useState<string | null>(null)
  const supabase = createClient()

  // Determine the base domain for tenant URLs
  const getTenantBaseUrl = (slug: string) => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost')
      const protocol = window.location.protocol
      const port = window.location.port ? `:${window.location.port}` : ''
      if (isLocalhost) {
        return `${protocol}//${slug}.localhost${port}`
      }
    }
    return `https://${slug}.brandassets.space`
  }

  useEffect(() => {
    loadSystemStats()
    loadTenants()
  }, [])

  const loadTenants = async () => {
    setIsLoadingTenants(true)
    setTenantError(null)
    try {
      // Try server action first
      const tenantData = await getAllTenantsForSuperAdmin()
      console.log('[DASHBOARD] Server action result:', tenantData)
      
      // If server action returns empty, try direct query as fallback
      if (!tenantData || tenantData.length === 0) {
        console.log('[DASHBOARD] Server action returned empty, trying direct query...')
        const { data: directClients, error: directError } = await supabase
          .from("clients")
          .select("id, name, slug")
          .eq("status", "active")
          .order("name")
        
        if (directError) {
          console.error('[DASHBOARD] Direct query error:', directError)
          setTenantError(`Database error: ${directError.message}`)
        } else {
          console.log('[DASHBOARD] Direct query result:', directClients)
          setTenants(directClients || [])
          if (!directClients || directClients.length === 0) {
            setTenantError('No active clients found in database')
          }
        }
      } else {
        setTenants(tenantData)
      }
    } catch (error: any) {
      console.error("Error loading tenants:", error)
      setTenantError(error?.message || 'Failed to load clients')
      setTenants([]) // Set empty array on error so UI can show message
    } finally {
      setIsLoadingTenants(false)
    }
  }

  const loadSystemStats = async () => {
    setIsLoading(true)
    try {
      // Get system statistics
      const [clientsResult, usersResult, storageResult] = await Promise.all([
        supabase.from("clients").select("id, status"),
        supabase.from("users").select("id"),
        supabase.from("assets").select("file_size")
      ])

      setStats({
        totalClients: clientsResult.data?.length || 0,
        activeClients: clientsResult.data?.filter((c: { status: string }) => c.status === 'active').length || 0,
        totalUsers: usersResult.data?.length || 0,
        totalStorageGB: Math.round((storageResult.data?.reduce((sum: number, asset: { file_size: number | null }) => sum + (asset.file_size || 0), 0) || 0) / 1024 / 1024 / 1024 * 100) / 100,
        recentActivity: [] // Could be populated with actual activity data
      })
    } catch (error) {
      console.error("Error loading system stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <DashboardHeaderSkeleton />
        <StatsGridSkeleton />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Overview</h1>
          <p className="text-gray-600 mt-1">Complete system administration and monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/system-admin/settings">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              System Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Tenant Access for SuperAdmin - Prominent placement */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <ExternalLink className="h-6 w-6 text-gray-700" />
            Client Navigation
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Navigate directly to client tenant interfaces. As a superadmin, you have automatic access to all tenants.
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingTenants ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : tenants && tenants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((tenant) => {
                  const tenantUrl = `${getTenantBaseUrl(tenant.slug)}/dashboard`
                  return (
                    <Button
                      key={tenant.id}
                      variant="outline"
                      className="h-auto p-4 justify-start hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                      onClick={async () => {
                        // Get current session tokens for cross-subdomain transfer
                        const { data: { session } } = await supabase.auth.getSession()
                        if (session) {
                          // Pass tokens via URL for cross-subdomain auth (localhost workaround)
                          const params = new URLSearchParams({
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                          })
                          window.location.href = `${tenantUrl}?auth_transfer=true&${params.toString()}`
                        } else {
                          window.location.href = tenantUrl
                        }
                      }}
                    >
                    <div className="flex items-center justify-between w-full">
                      <div className="text-left">
                        <h3 className="font-medium text-gray-900">{tenant.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {getTenantBaseUrl(tenant.slug).replace('https://', '').replace('http://', '')}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors ml-4 flex-shrink-0" />
                    </div>
                  </Button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="font-medium text-gray-900 mb-2">
                {tenantError ? 'Error loading clients' : 'No active clients found'}
              </p>
              {tenantError ? (
                <p className="text-sm text-red-600">{tenantError}</p>
              ) : (
                <>
                  <p>No active clients found.</p>
                  <p className="text-sm mt-2">Clients will appear here once they are created and active.</p>
                  <Link href="/system-admin/clients/create" className="mt-4 inline-block">
                    <Button variant="outline" size="sm">
                      Create First Client
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats?.totalClients || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Registered clients</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats?.activeClients || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Active subscriptions</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">System Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Total registered users</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats?.totalStorageGB || 0}</div>
            <p className="text-xs text-gray-500 mt-1">GB used across all clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/system-admin/clients">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Client Management</CardTitle>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Manage all client accounts, domains, and subscriptions
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/system-admin/users">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">User Administration</CardTitle>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Manage system users, permissions, and access levels
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/system-admin/settings">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">System Settings</CardTitle>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Configure system-wide settings and preferences
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>System Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>Activity monitoring coming soon...</p>
            <p className="text-sm mt-2">Track client registrations, user activity, and system events</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
