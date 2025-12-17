'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthBridge() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const uid = searchParams.get('uid')
  const exp = searchParams.get('exp')

  console.log('[AUTH-BRIDGE] Component mounted!')
  console.log('[AUTH-BRIDGE] Current URL:', window.location.href)
  console.log('[AUTH-BRIDGE] Search params:', { uid, exp })

  // Log current cookies for debugging
  const allCookies = document.cookie
  const sbCookies = allCookies.split(';').filter(c =>
    c.trim().startsWith('sb-') || c.trim().includes('supabase')
  )
  console.log('[AUTH-BRIDGE] Current cookies:', {
    allCookies: allCookies || 'none',
    sbCookies: sbCookies.length > 0 ? sbCookies : 'none found'
  })

  useEffect(() => {
    const handleAuthBridge = async () => {
      console.log('[AUTH-BRIDGE] useEffect triggered')

      if (!uid || !exp) {
        console.log('[AUTH-BRIDGE] Missing uid or exp, skipping')
        return
      }

      // Tjek om token er udløbet (30 sekunder)
      const now = Date.now()
      const expiresAt = parseInt(exp)
      const isExpired = now > expiresAt

      console.log('[AUTH-BRIDGE] Time validation:', {
        now,
        expiresAt,
        isExpired,
        timeLeft: expiresAt - now
      })

      if (isExpired) {
        console.log('[AUTH-BRIDGE] Token expired, skipping')
        return
      }

      console.log('[AUTH-BRIDGE] Valid token, syncing session for user', uid)

      try {
        // Sync session via API
        const response = await fetch('/api/auth/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bridgeUserId: uid,
          })
        })

          if (response.ok) {
            console.log('[AUTH-BRIDGE] Session synced successfully')
            // Redirect til clean URL uden auth params
            const url = new URL(window.location.href)
            url.searchParams.delete('uid')
            url.searchParams.delete('exp')
            const cleanUrl = url.pathname + url.search
            console.log('[AUTH-BRIDGE] Redirecting to clean URL:', cleanUrl)
            router.replace(cleanUrl)
          } else {
            const errorData = await response.json()
            console.error('[AUTH-BRIDGE] Session sync failed:', errorData)
          }
      } catch (error) {
        console.error('[AUTH-BRIDGE] Auth bridge failed:', error)
      }
    }

    handleAuthBridge()
  }, [uid, exp, router])

  return null // Denne component render ikke noget
}