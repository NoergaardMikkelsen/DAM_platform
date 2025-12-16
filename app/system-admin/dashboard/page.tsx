"use client"

import { createClient } from "@/lib/supabase/client"
import { getAllTenantsForSuperAdmin } from "./actions"
import { Settings, ArrowRight, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { DashboardHeaderSkeleton, StatsGridSkeleton } from "@/components/skeleton-loaders"

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
  const supabase = createClient()

  // Determine the base domain for tenant URLs
  const getTenantBaseUrl = (slug: string) => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost')
      const protocol = window.location.protocol
      if (isLocalhost) {
        return `${protocol}//${slug}.localhost`
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
    try {
      const tenantData = await getAllTenantsForSuperAdmin()
      setTenants(tenantData)
    } catch (error) {
      console.error("Error loading tenants:", error)
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
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            System Settings
          </Button>
        </div>
      </div>

      {/* Tenant Access for SuperAdmin */}
      {tenants && tenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Client Navigation
            </CardTitle>
            <p className="text-sm text-gray-600">
              Navigate to client tenant interfaces. Access within each tenant is still controlled by tenant membership and authorization rules.
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingTenants ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((tenant) => (
                  <a
                    key={tenant.id}
                    href={`${getTenantBaseUrl(tenant.slug)}/dashboard`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">{tenant.name}</h3>
                      <p className="text-sm text-gray-500">{getTenantBaseUrl(tenant.slug).replace('https://', '').replace('http://', '')}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
