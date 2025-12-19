'use client'

import { useState, useEffect } from "react"
import { InitialLoadingScreen } from "@/components/ui/initial-loading-screen"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"

interface TenantLayoutClientProps {
  tenant: any
  userData: any
  role: string | null
  children: React.ReactNode
}

// Client-side layout component that handles loading screen and main layout
export default function TenantLayoutClient({ tenant, userData, role, children }: TenantLayoutClientProps) {
  const [showContent, setShowContent] = useState(false)
  const [showLoadingScreen, setShowLoadingScreen] = useState(true)

  useEffect(() => {
    // Show loading screen only on first visit to tenant area in this session
    const hasSeenTenantLoading = sessionStorage.getItem('hasSeenTenantLoading')

    if (!hasSeenTenantLoading) {
      // First time ever - show loading experience
      sessionStorage.setItem('hasSeenTenantLoading', 'true')
    } else {
      // Returning user - skip loading screen, show content immediately
      setShowLoadingScreen(false)
      setShowContent(true)
    }
  }, [])

  const handleLoadingComplete = () => {
    setShowLoadingScreen(false)
    setShowContent(true)
  }

  return (
    <>
      {/* Show loading screen overlay until it completes */}
      {showLoadingScreen && (
        <InitialLoadingScreen
          onComplete={handleLoadingComplete}
          tenantLogo={tenant.logo_url}
        />
      )}

      {/* Show layout content - only when loading is complete and content should be visible */}
      {showContent && (
        <div className="tenant-layout-wrapper visible">
          <div className="flex h-screen overflow-hidden bg-gray-50">
            <SidebarVisibility>
              <Sidebar user={userData} role={role || undefined} />
            </SidebarVisibility>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      )}
    </>
  )
}