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

export function TenantLayoutClient({ tenant, userData, role, children }: TenantLayoutClientProps) {
  const [showContent, setShowContent] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    // Always show loading screen initially when component mounts
    // This ensures no content flash when navigating to tenant pages
    const hasSeenInitialLoading = sessionStorage.getItem('hasSeenInitialLoading')

    if (!hasSeenInitialLoading) {
      // First time ever - show full loading experience
      sessionStorage.setItem('hasSeenInitialLoading', 'true')
      // Keep content hidden until loading completes
    } else {
      // Returning user - still show brief loading to prevent flash
      setTimeout(() => setShowContent(true), 100) // Brief delay for smooth transition
    }

    setHasInitialized(true)
  }, [])

  // Don't render anything until we've initialized
  if (!hasInitialized) {
    return <InitialLoadingScreen onComplete={() => setShowContent(true)} />
  }

  return (
    <>
      {/* Show loading screen overlay until content should be visible */}
      {!showContent && (
        <InitialLoadingScreen onComplete={() => setShowContent(true)} />
      )}

      {/* Show layout content - hidden by default with CSS */}
      <div className={`tenant-layout-wrapper ${showContent ? 'visible' : ''}`}>
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <SidebarVisibility>
            <Sidebar user={userData} role={role || undefined} />
          </SidebarVisibility>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </>
  )
}