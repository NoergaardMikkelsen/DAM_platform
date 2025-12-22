'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import jwt from 'jsonwebtoken'

export function BridgeTokenHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const bridgeToken = searchParams.get('bridge')

  useEffect(() => {
    const handleBridgeToken = async () => {
      if (!bridgeToken) return

      try {
        const payload = jwt.verify(bridgeToken, process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET || 'fallback-secret') as {
          userId: string
          targetDomain: string
          exp: number
        }

        // Validate token
        if (payload.targetDomain === window.location.host && payload.exp > Math.floor(Date.now() / 1000)) {

          // Sync session via API
          const response = await fetch('/api/auth/sync-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bridgeUserId: payload.userId,
            })
          })

          if (response.ok) {
            // Redirect to clean URL without bridge token
            const url = new URL(window.location.href)
            url.searchParams.delete('bridge')
            router.replace(url.pathname + url.search)
          } else {
            console.error('[BRIDGE] Session sync failed')
          }
        } else {
          console.error('[BRIDGE] Token invalid or expired')
        }
      } catch (error) {
        console.error('[BRIDGE] Token validation failed:', error)
      }
    }

    handleBridgeToken()
  }, [bridgeToken, router])

  return null // This component renders nothing
}