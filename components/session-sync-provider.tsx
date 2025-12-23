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
    // Sync session when component mounts
    const syncSession = async () => {
      try {
        const supabase = createClient()
        const success = await syncSessionAcrossSubdomains(supabase)
        console.log('[SESSION-SYNC-PROVIDER] Session sync completed:', success ? 'success' : 'no session to sync')
      } catch (error) {
        console.error('[SESSION-SYNC-PROVIDER] Session sync failed:', error)
        // Don't crash the app if session sync fails
      }
    }

    syncSession()
  }, [])

  return <>{children}</>
}

