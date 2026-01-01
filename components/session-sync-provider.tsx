"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { syncSessionAcrossSubdomains } from "@/lib/utils/session-sync"

/**
 * Client component that syncs session across subdomains when the page loads
 * This ensures cookies are set with the correct domain for cross-subdomain sharing
 */
export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Sync session when component mounts - optional for better UX
    // No longer critical since we get user data from server-side context
    const syncSession = async () => {
      try {
        const supabase = createClient()
        await syncSessionAcrossSubdomains(supabase)
      } catch {
        // Session sync is optional - silently fail since it's not critical
      }
    }

    syncSession()
  }, [])

  return <>{children}</>
}

