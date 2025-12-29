"use client"

import { BookOpen, Building, Home, LogOut, Tag, Upload, Users, ChevronLeft, ChevronRight, Settings, BarChart3, Shield, Briefcase } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { UploadAssetModal } from "@/components/upload-asset-modal"

type SidebarProps = {
  user: {
    full_name: string
    email: string
  }
  role?: string
  isSystemAdminContext?: boolean // True when on admin.* subdomain
}

export function Sidebar({ user, role, isSystemAdminContext = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  // Only use tenant context in tenant layout, not in system-admin
  const tenant = isSystemAdminContext ? null : useTenant().tenant


  const handleLogout = async () => {
    try {
      // Clear all auth state
      await supabase.auth.signOut()

      // Clear local storage and session storage
      if (typeof window !== 'undefined') {
        // Clear Supabase auth tokens
        localStorage.removeItem('sb-auth-token')
        sessionStorage.clear()

        // Clear any other auth-related localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            localStorage.removeItem(key)
          }
        })
      }

      // Small delay to ensure cleanup is complete
      setTimeout(() => {
        // Force navigation to login page (same subdomain)
        window.location.href = '/login'
      }, 100)

    } catch (error) {
      console.error('Logout error:', error)
      // Fallback - still redirect to login
      window.location.href = '/login'
    }
  }

  // Different main navigation based on context and role
  const getMainNavItems = () => {
    // System admin context (admin.* subdomain) - no main nav for superadmins
    if (isSystemAdminContext && role === "superadmin") {
      return []
    }

    // Tenant context - always show tenant navigation (even for superadmins)
    const baseItems = [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/assets", label: "Asset Library", icon: BookOpen },
    ]

    return baseItems
  }

  const mainNavItems = getMainNavItems()

  // Different admin items based on context and role type
  const getAdminNavItems = () => {
    // System admin context (admin.* subdomain) - show system admin navigation
    if (isSystemAdminContext && role === "superadmin") {
      return [
        { href: "/system-admin/dashboard", label: "System Overview", icon: BarChart3 },
        { href: "/system-admin/clients", label: "Client Management", icon: Briefcase },
        { href: "/system-admin/users", label: "System Users", icon: Shield },
        { href: "/system-admin/settings", label: "System Settings", icon: Settings },
      ]
    }
    
    // Tenant context - show client admin navigation for all users (but create buttons are hidden for user role)
    return [
      { href: "/users", label: "Users", icon: Users },
      { href: "/tagging", label: "Tagging", icon: Tag },
    ]
  }

  const adminNavItems = getAdminNavItems()
  const isAdmin = role === "admin" || role === "superadmin"
  const showAdminSection = adminNavItems.length > 0 // Show admin section if there are admin nav items

  // Button size for calculations
  const buttonSize = 48;
  
  return (
    <div
      className={`relative ${isCollapsed ? 'w-16' : 'w-72'}`}
      style={{
        marginTop: '16px',
        marginLeft: '16px',
        marginBottom: isCollapsed ? `${buttonSize + 16}px` : '30px',
        height: isCollapsed ? `calc(100% - ${buttonSize + 32}px)` : '-webkit-fill-available',
        transition: 'width 300ms ease-in-out',
        willChange: 'width',
      }}
    >
      {/* Main sidebar SVG shape with organic curve - same style as collection cards */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={isCollapsed ? "0 0 64 800" : "0 0 288 939"}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sidebar mask with organic shape matching collection cards */}
          {/* When expanded: indentation for toggle button at bottom-right */}
          {/* When collapsed: simple rounded rectangle, button is below */}
          <mask id="sidebarMask" maskUnits="userSpaceOnUse" x="0" y="0" width={isCollapsed ? "64" : "288"} height={isCollapsed ? "800" : "939"}>
            <path
              d={isCollapsed
                ? "M0 32C0 14.3269 14.3269 0 32 0H32C49.6731 0 64 14.3269 64 32V768C64 785.673 49.6731 800 32 800H32C14.3269 800 0 785.673 0 768V32Z"
                : "M0 32C0 14.3269 14.3269 0 32 0H256C273.673 0 288 14.3269 288 32V845.79C288 859.437 276.937 870.5 263.29 870.5H257.29C239.617 870.5 225.29 884.827 225.29 902.5V909.5C225.29 925.792 212.082 939 195.79 939H32C14.3269 939 0 924.673 0 907V32Z"
              }
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
          width={isCollapsed ? "64" : "288"}
          height={isCollapsed ? "800" : "939"}
          fill="url(#sidebarGradient)"
          mask="url(#sidebarMask)"
        />

        {/* Border with organic curve matching collection cards */}
        <path
          d={isCollapsed
            ? "M0 32C0 14.3269 14.3269 0 32 0H32C49.6731 0 64 14.3269 64 32V768C64 785.673 49.6731 800 32 800H32C14.3269 800 0 785.673 0 768V32Z"
            : "M0 32C0 14.3269 14.3269 0 32 0H256C273.673 0 288 14.3269 288 32V845.79C288 859.437 276.937 870.5 263.29 870.5H257.29C239.617 870.5 225.29 884.827 225.29 902.5V909.5C225.29 925.792 212.082 939 195.79 939H32C14.3269 939 0 924.673 0 907V32Z"
          }
          fill="none"
          stroke="rgba(0, 0, 0, 0.05)"
          strokeWidth="1"
        />
      </svg>

      {/* Content container */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Logo */}
        <div className={`flex items-center ${isCollapsed ? 'h-16 px-4 justify-center' : 'h-20 px-6'}`} style={{ transition: 'padding 300ms ease-in-out' }}>
          {isSystemAdminContext && role === "superadmin" ? (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-black text-white font-bold text-sm`}>
                SA
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <div className="text-sm font-semibold text-gray-900">Digital Asset Management</div>
                  <div className="text-xs text-gray-500">System Admin</div>
                </div>
              )}
            </div>
          ) : (
            <img
              src={isCollapsed ? (tenant?.logo_collapsed_url || "/logo/logo_collapsed.png") : (tenant?.logo_url || "/logo/59b3f6b6c3c46621b356d5f49bb6efe368efa9ad.png")}
              alt={`${tenant?.name || 'Nørgård Mikkelsen'} Logo`}
              className={isCollapsed ? 'w-8 h-auto' : 'h-12 w-auto'}
              style={{ transition: 'width 300ms ease-in-out, height 300ms ease-in-out' }}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className={`space-y-2 ${isCollapsed ? 'px-4' : 'px-3'}`} style={{ transition: 'padding 300ms ease-in-out' }}>
            {mainNavItems.length > 0 && !isCollapsed && <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Main</div>}
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative block w-full mb-2 group"
                  title={isCollapsed ? item.label : undefined}
                >
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: '100%',
                      height: '48px',
                      filter: isActive ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08))',
                      transition: 'filter 200ms ease-in-out',
                    }}
                  >
                    <svg
                      viewBox={isCollapsed ? "0 0 56 48" : "0 0 220 48"}
                      className="w-full h-full absolute inset-0"
                      xmlns="http://www.w3.org/2000/svg"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        <mask id={`navMask-${item.href.replace('/', '')}`} maskUnits="userSpaceOnUse" x="0" y="0" width={isCollapsed ? "56" : "220"} height="48">
                          <path
                            d={isCollapsed
                              ? "M0 36V12C0 5.37258 5.37258 0 12 0H44C50.6274 0 56 5.37258 56 12V36C56 42.6274 50.6274 48 44 48H12C5.37258 48 0 42.6274 0 36Z"
                              : "M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                            }
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
                        width={isCollapsed ? "56" : "220"}
                        height="48"
                        fill={`url(#navGradient-${item.href.replace('/', '')})`}
                        mask={`url(#navMask-${item.href.replace('/', '')})`}
                      />

                      <path
                        d={isCollapsed
                          ? "M0 36V12C0 5.37258 5.37258 0 12 0H44C50.6274 0 56 5.37258 56 12V36C56 42.6274 50.6274 48 44 48H12C5.37258 48 0 42.6274 0 36Z"
                          : "M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                        }
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth="1"
                      />
                    </svg>

                    <div
                      className={`absolute inset-0 flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
                      style={{
                        color: isActive ? '#1f2937' : '#6b7280',
                        fontWeight: '500',
                        fontSize: '14px',
                        transition: 'padding 300ms ease-in-out, gap 300ms ease-in-out',
                      }}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                  </div>
                </Link>
              )
            })}

            {showAdminSection && (
              <>
                {!isCollapsed && <div className="mb-4 mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Admin</div>}
                {adminNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative block w-full mb-2 group"
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div
                        className="relative overflow-hidden"
                        style={{
                          width: '100%',
                          height: '48px',
                          filter: isActive ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08))',
                          transition: 'filter 200ms ease-in-out',
                        }}
                      >
                        <svg
                          viewBox={isCollapsed ? "0 0 56 48" : "0 0 220 48"}
                          className="w-full h-full absolute inset-0"
                          xmlns="http://www.w3.org/2000/svg"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <defs>
                            <mask id={`adminNavMask-${item.href.replace('/', '')}`} maskUnits="userSpaceOnUse" x="0" y="0" width={isCollapsed ? "56" : "220"} height="48">
                              <path
                                d={isCollapsed
                                  ? "M0 36V12C0 5.37258 5.37258 0 12 0H44C50.6274 0 56 5.37258 56 12V36C56 42.6274 50.6274 48 44 48H12C5.37258 48 0 42.6274 0 36Z"
                                  : "M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                                }
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
                            width={isCollapsed ? "56" : "220"}
                            height="48"
                            fill={`url(#adminNavGradient-${item.href.replace('/', '')})`}
                            mask={`url(#adminNavMask-${item.href.replace('/', '')})`}
                          />

                          <path
                            d={isCollapsed
                              ? "M0 36V12C0 5.37258 5.37258 0 12 0H44C50.6274 0 56 5.37258 56 12V36C56 42.6274 50.6274 48 44 48H12C5.37258 48 0 42.6274 0 36Z"
                              : "M0 36V12C0 5.37258 5.37258 0 12 0H196.195C202.67 0 207.02 5.17764 207.181 11.652C207.598 33.258 208.304 48 208.304 48H12C5.37258 48 0 42.6274 0 36Z"
                            }
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.3)"
                            strokeWidth="1"
                          />
                        </svg>

                        <div
                          className={`absolute inset-0 flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
                          style={{
                            color: isActive ? '#1f2937' : '#6b7280',
                            fontWeight: '500',
                            fontSize: '14px',
                            transition: 'padding 300ms ease-in-out, gap 300ms ease-in-out',
                          }}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Upload Button - Only show in tenant context (not in system admin context) */}
        {!isSystemAdminContext && (
          <div className={`${isCollapsed ? 'px-3 py-2' : 'px-3 py-2'}`} style={{ transition: 'padding 300ms ease-in-out' }}>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className={isCollapsed ? 'w-10 h-10 p-0 mx-auto' : 'w-full'}
              title={isCollapsed ? "Upload" : undefined}
              style={{
                backgroundColor: tenant?.primary_color || '#DF475C',
                borderRadius: isCollapsed ? '50%' : '25px',
                padding: isCollapsed ? '0' : '24px 16px',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'width 300ms ease-in-out, height 300ms ease-in-out, border-radius 300ms ease-in-out, padding 300ms ease-in-out',
              }}
            >
              <Upload className={`${isCollapsed ? '' : 'mr-2'} h-4 w-4`} />
              {!isCollapsed && 'Upload'}
            </Button>
          </div>
        )}

        {/* User Profile */}
        <div className={`pb-20 pt-2 relative z-10 ${isCollapsed ? 'px-4' : 'px-4'}`} style={{ transition: 'padding 300ms ease-in-out' }}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center mb-2' : 'gap-3 rounded-lg p-2'}`}>
            <Link href={isSystemAdminContext && role === "superadmin" ? "/system-admin/profile" : "/profile"} className={`${isCollapsed ? 'block' : 'flex items-center gap-3 rounded-lg p-2'}`} title={isCollapsed ? "Profile" : undefined}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: tenant?.primary_color || '#000000' }}>
                {(user.full_name || user.email)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-sm font-medium text-gray-900">{user.full_name || user.email}</div>
                  <div className="truncate text-xs text-gray-500">{user.email}</div>
                </div>
              )}
            </Link>
          </div>
          <Button
            className={`${isCollapsed ? 'w-10 h-10 p-0 justify-center mb-4' : 'w-full justify-start'} text-gray-600`}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: 'width 300ms ease-in-out, padding 300ms ease-in-out',
            }}
            onClick={handleLogout}
            title={isCollapsed ? "Log out" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Log out</span>}
          </Button>
        </div>

        {/* Toggle Button */}
        {/* When expanded: positioned perfectly in the SVG indentation notch */}
        {/* When collapsed: centered below the sidebar */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute rounded-full flex items-center justify-center hover:bg-gray-300 pointer-events-auto z-20"
          style={{
            width: `${buttonSize}px`,
            height: `${buttonSize}px`,
            backgroundColor: '#E5E5E5',
            cursor: 'pointer',
            transition: 'bottom 300ms ease-in-out, left 300ms ease-in-out, right 300ms ease-in-out, transform 300ms ease-in-out, background-color 200ms ease-in-out',
            ...(isCollapsed ? {
              bottom: `-${buttonSize + 8}px`,
              left: '50%',
              transform: 'translateX(-50%)',
            } : {
              bottom: '3.2%',
              right: '9%',
              transform: 'translate(50%, 50%)',
            }),
          }}
          aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          <svg
            viewBox="0 8 25 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid"
            style={{
              width: '24px',
              height: '20px',
              transform: isCollapsed ? 'none' : 'scaleX(-1)',
              transition: 'transform 0.3s ease',
            }}
          >
            <path
              d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
              stroke="black"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>

      {/* Upload Modal - Only render in tenant context */}
      {!isSystemAdminContext && (
        <UploadAssetModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          onSuccess={() => {
            // Could refresh data or show success message
            console.log('Upload completed successfully')
          }}
        />
      )}
    </div>
  )
}
