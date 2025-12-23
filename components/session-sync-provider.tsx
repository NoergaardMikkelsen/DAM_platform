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
    // Sync session when component mounts - this helps with subdomain switching
    const syncSession = async () => {
      try {
        const supabase = createClient()
        const success = await syncSessionAcrossSubdomains(supabase)

        // If no session was found (normal when switching subdomains), try again after a delay
        if (!success) {
          console.log('[SESSION-SYNC-PROVIDER] No session found, will retry in 2 seconds...')
          setTimeout(async () => {
            try {
              const retrySuccess = await syncSessionAcrossSubdomains(supabase)
              console.log('[SESSION-SYNC-PROVIDER] Retry session sync completed:', retrySuccess ? 'success' : 'still no session')
            } catch (retryError) {
              console.error('[SESSION-SYNC-PROVIDER] Retry session sync failed:', retryError)
            }
          }, 2000)
        } else {
          console.log('[SESSION-SYNC-PROVIDER] Session sync completed successfully')
        }
      } catch (error) {
        console.error('[SESSION-SYNC-PROVIDER] Session sync failed:', error)
        // Don't crash the app if session sync fails
      }
    }

    syncSession()
  }, [])

  return <>{children}</>
}

