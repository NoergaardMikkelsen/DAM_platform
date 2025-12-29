'use client'

import { useState, useEffect, useLayoutEffect } from "react"
import { InitialLoadingScreen } from "@/components/ui/initial-loading-screen"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarVisibility } from "@/components/layout/sidebar-visibility"
import { Toaster } from "@/components/ui/toaster"

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

  // Update favicon dynamically based on tenant - MUST run immediately on mount, before browser paint
  // useLayoutEffect runs synchronously before browser paint, ensuring favicon is set early
  useLayoutEffect(() => {
    if (!tenant) return

    // Remove ALL existing favicon links (including any from root layout metadata)
    // Also remove favicon.ico requests that browsers might make
    const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[href*="favicon"]')
    existingLinks.forEach(link => link.remove())

    // Only use favicon from storage - no fallback to default
    const faviconUrl = tenant.favicon_url || tenant.logo_url
    const appleIconUrl = tenant.favicon_url || tenant.logo_url

    if (!faviconUrl) {
      // No favicon available - don't set anything (let browser use default or nothing)
      return
    }

    // Create new favicon link with cache busting to ensure fresh load
    // Use timestamp in addition to tenant ID for better cache busting
    const cacheBuster = `${tenant.id}-${Date.now()}`
    const faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'
    faviconLink.type = 'image/png'
    faviconLink.href = `${faviconUrl}?v=${cacheBuster}`
    document.head.appendChild(faviconLink)

    // Also update apple-touch-icon
    const appleLink = document.createElement('link')
    appleLink.rel = 'apple-touch-icon'
    appleLink.href = `${appleIconUrl}?v=${cacheBuster}`
    document.head.appendChild(appleLink)

    // Force browser to reload favicon by creating a temporary link and removing it
    // This helps with aggressive browser caching
    setTimeout(() => {
      const tempLink = document.createElement('link')
      tempLink.rel = 'icon'
      tempLink.href = `${faviconUrl}?v=${cacheBuster}&force=${Date.now()}`
      document.head.appendChild(tempLink)
      setTimeout(() => tempLink.remove(), 100)
    }, 100)

    // Cleanup function to remove links if component unmounts or tenant changes
    return () => {
      faviconLink.remove()
      appleLink.remove()
    }
  }, [tenant?.id, tenant?.favicon_url, tenant?.logo_url, tenant?.slug])

  useEffect(() => {
    // Show loading screen only on first visit to tenant area in this session
    const hasSeenTenantLoading = sessionStorage.getItem('hasSeenTenantLoading')

    if (hasSeenTenantLoading === 'completed') {
      // User has seen the full loading experience - skip loading screen
      setShowLoadingScreen(false)
      setShowContent(true)
    } else {
      // First time or loading in progress - show loading screen
      // Don't set sessionStorage yet - wait for loading to complete
    }
  }, [])

  const handleLoadingComplete = () => {
    // Mark loading as completed in sessionStorage
    sessionStorage.setItem('hasSeenTenantLoading', 'completed')
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
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
          <Toaster />
        </div>
      )}
    </>
  )
}