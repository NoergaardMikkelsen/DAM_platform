"use client"

import { BookOpen, Building, Home, LogOut, Tag, Upload, Users, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useState } from "react"

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
  const [isCollapsed, setIsCollapsed] = useState(false)

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
    <div 
      className={`relative h-screen overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0' : 'w-64'}`}
      style={{
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))',
      }}
    >
      {/* Main sidebar SVG shape with organic curve - same style as collection cards */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 256 939"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sidebar mask with organic shape matching collection cards */}
          {/* 32px border radius in corners, indentation for Upload button */}
          {/* Exact path from design - indentation starts at V845.79, log out is above it */}
          <mask id="sidebarMask" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="939">
            <path
              d="M0 32C0 14.3269 14.3269 0 32 0H224C241.673 0 256 14.3269 256 32V845.79C256 859.437 244.937 870.5 231.29 870.5H225.29C207.617 870.5 193.29 884.827 193.29 902.5V909.5C193.29 925.792 180.082 939 163.79 939H32C14.3269 939 0 924.673 0 907V32Z"
              fill="white"
            />
          </mask>

          {/* Gradient for sidebar */}
          <linearGradient id="sidebarGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.98)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.95)" />
          </linearGradient>
        </defs>

        {/* Sidebar background */}
        <rect
          x="0"
          y="0"
          width="256"
          height="939"
          fill="url(#sidebarGradient)"
          mask="url(#sidebarMask)"
        />

        {/* Border with organic curve matching collection cards */}
        <path
          d="M0 32C0 14.3269 14.3269 0 32 0H224C241.673 0 256 14.3269 256 32V845.79C256 859.437 244.937 870.5 231.29 870.5H225.29C207.617 870.5 193.29 884.827 193.29 902.5V909.5C193.29 925.792 180.082 939 163.79 939H32C14.3269 939 0 924.673 0 907V32Z"
          fill="none"
          stroke="rgba(0, 0, 0, 0.05)"
          strokeWidth="1"
        />
      </svg>

      {/* Content container */}
      <div className={`relative z-10 flex h-full flex-col transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
          <div className="space-y-3 px-3">
            <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Main</div>
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative block w-full mb-2"
                >
                  <div
                    className="relative overflow-hidden transition-all duration-300"
                    style={{
                      width: '100%',
                      height: '48px',
                      filter: isActive ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08))',
                    }}
                  >
                    <svg
                      viewBox="0 0 220 48"
                      className="w-full h-full absolute inset-0"
                      xmlns="http://www.w3.org/2000/svg"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        <mask id={`navMask-${item.href.replace('/', '')}`} maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="48">
                          <path
                            d="M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                            fill="white"
                          />
                        </mask>

                        <linearGradient id={`navGradient-${item.href.replace('/', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={isActive ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.1)"} />
                          <stop offset="100%" stopColor={isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)"} />
                      </linearGradient>
                      </defs>

                      <rect
                        x="0"
                        y="0"
                        width="220"
                        height="48"
                        fill={`url(#navGradient-${item.href.replace('/', '')})`}
                        mask={`url(#navMask-${item.href.replace('/', '')})`}
                      />

                      <path
                        d="M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth="1"
                      />
                    </svg>

                    <div
                      className="absolute inset-0 flex items-center gap-3 px-4 py-3"
                      style={{
                        color: isActive ? '#1f2937' : '#6b7280',
                        fontWeight: '500',
                        fontSize: '14px',
                      }}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </div>
                </Link>
              )
            })}

            {isAdmin && (
              <>
                <div className="mb-4 mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Admin</div>
                {adminNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative block w-full mb-2"
                    >
                      <div
                        className="relative overflow-hidden transition-all duration-300"
                        style={{
                          width: '100%',
                          height: '48px',
                          filter: isActive ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08))',
                        }}
                      >
                        <svg
                          viewBox="0 0 220 48"
                          className="w-full h-full absolute inset-0"
                          xmlns="http://www.w3.org/2000/svg"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <defs>
                            <mask id={`adminNavMask-${item.href.replace('/', '')}`} maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="48">
                              <path
                                d="M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                                fill="white"
                              />
                            </mask>

                            <linearGradient id={`adminNavGradient-${item.href.replace('/', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor={isActive ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.1)"} />
                              <stop offset="100%" stopColor={isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)"} />
                            </linearGradient>
                          </defs>

                          <rect
                            x="0"
                            y="0"
                            width="220"
                            height="48"
                            fill={`url(#adminNavGradient-${item.href.replace('/', '')})`}
                            mask={`url(#adminNavMask-${item.href.replace('/', '')})`}
                          />

                          <path
                            d="M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.3)"
                            strokeWidth="1"
                          />
                        </svg>

                        <div
                          className="absolute inset-0 flex items-center gap-3 px-4 py-3"
                          style={{
                            color: isActive ? '#1f2937' : '#6b7280',
                            fontWeight: '500',
                            fontSize: '14px',
                          }}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <div className="border-t px-4 py-4">
          <Link href="/assets/upload" className="block">
            <Button className="w-full bg-[#DF475C] hover:bg-[#C82333] rounded-lg">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </Link>
        </div>

        {/* User Profile - positioned ABOVE indentation */}
        <div className="border-t p-4 relative z-10">
          <Link href="/profile" className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DF475C] text-sm font-semibold text-white">
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

        {/* Toggle Button - positioned OUTSIDE the indentation, to the right of SVG path */}
        {/* Same style as collection card buttons - positioned outside SVG curve */}
        <div className="absolute bottom-4 right-0" style={{ zIndex: 30 }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="relative overflow-visible transition-all duration-300 hover:scale-105 cursor-pointer pointer-events-auto z-20 rounded-full flex items-center justify-center"
            style={{
              width: '48px',
              height: '48px',
              marginRight: isCollapsed ? '8px' : 'clamp(8px, 2cqw, 16px)', // Position outside SVG indentation, matching collection card style
              backgroundColor: '#E5E5E5',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12))',
            }}
            aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-6 w-6 text-gray-700" />
            ) : (
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
