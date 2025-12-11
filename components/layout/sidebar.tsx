"use client"

import { BookOpen, Building, Home, LogOut, Tag, Upload, Users } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type SidebarProps = {
  user: {
    full_name: string
    email: string
  }
  role?: string
}

export function Sidebar({ user, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  console.log("Sidebar role:", role)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const mainNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/assets", label: "Asset Library", icon: BookOpen },
  ]

  const adminNavItems = [
    { href: "/clients", label: "Clients", icon: Building },
    { href: "/users", label: "Users", icon: Users },
    { href: "/tagging", label: "Tagging", icon: Tag },
  ]

  const isAdmin = role === "admin" || role === "superadmin"

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center border-b px-6">
        <img
          src="/logo/59b3f6b6c3c46621b356d5f49bb6efe368efa9ad.png"
          alt="Nørgård Mikkelsen Logo"
          className="h-12 w-auto"
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="space-y-1 px-3">
          <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Main</div>
          {mainNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <div className="mb-4 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Admin</div>
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Upload Button */}
      <div className="border-t p-4">
        <Link href="/assets/upload">
          <Button className="w-full bg-[#dc3545] hover:bg-[#c82333]">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </Link>
      </div>

      {/* User Profile */}
      <div className="border-t p-4">
        <Link href="/profile" className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dc3545] text-sm font-semibold text-white">
            {(user.full_name || user.email)
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm font-medium text-gray-900">{user.full_name || user.email}</div>
            <div className="truncate text-xs text-gray-500">{user.email}</div>
          </div>
        </Link>
        <Button variant="ghost" className="mt-2 w-full justify-start text-gray-600" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  )
}
