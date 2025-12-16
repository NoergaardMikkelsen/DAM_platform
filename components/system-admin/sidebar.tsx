"use client"

import {
  Building,
  Users,
  Settings,
  LogOut,
  BarChart3,
  Shield,
  ExternalLink
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface Client {
  id: string
  name: string
  slug: string
  domain: string | null
}

interface SystemAdminSidebarProps {
  clients?: Client[]
}

export function SystemAdminSidebar({ clients = [] }: SystemAdminSidebarProps) {
  const supabase = createClient()

  const navItems = [
    { href: "/system-admin/dashboard", label: "System Overview", icon: BarChart3 },
    { href: "/system-admin/clients", label: "Client Management", icon: Building },
    { href: "/system-admin/users", label: "System Users", icon: Users },
    { href: "/system-admin/settings", label: "System Settings", icon: Settings },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  // Generate full URLs for client access
  const getClientUrl = (client: Client): string => {
    // Use custom domain if available
    if (client.domain) {
      const protocol = process.env.NEXT_PUBLIC_CLIENT_PROTOCOL || 'http'
      return `${protocol}://${client.domain}`
    }

    // Temporary: construct subdomain URL for development
    // TODO: Update with real domain when available
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost:3000'
    const protocol = process.env.NEXT_PUBLIC_CLIENT_PROTOCOL || 'http'
    return `${protocol}://${client.slug}.${baseDomain}`
  }

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="font-semibold text-gray-900">System Admin</h1>
            <p className="text-sm text-gray-500">DAM Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50">
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Client Access Links */}
        {clients.length > 0 && (
          <div className="mt-6">
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Client Access
            </h3>
            <ul className="space-y-1">
              {clients.slice(0, 5).map((client) => (
                <li key={client.id}>
                  <a
                    href={getClientUrl(client)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Building className="h-4 w-4" />
                    <span className="font-medium truncate">{client.name}</span>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-700 hover:bg-gray-50"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  )
}
