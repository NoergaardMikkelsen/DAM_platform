'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthBridge() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const uid = searchParams.get('uid')
  const exp = searchParams.get('exp')

  useEffect(() => {
    const handleAuthBridge = async () => {
      if (!uid || !exp) {
        return
      }

      // Check if token is expired (30 seconds)
      const now = Date.now()
      const expiresAt = parseInt(exp)
      const isExpired = now > expiresAt

      if (isExpired) {
        return
      }

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
            // Redirect to clean URL without auth params
            const url = new URL(window.location.href)
            url.searchParams.delete('uid')
            url.searchParams.delete('exp')
            router.replace(url.pathname + url.search)
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