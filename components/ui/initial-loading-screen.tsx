'use client'

import { useEffect, useState } from 'react'
import { useTenant } from '@/lib/context/tenant-context'

export function InitialLoadingScreen({
  onComplete,
  tenantLogo
}: {
  onComplete: () => void
  tenantLogo?: string
}) {
  const { tenant } = useTenant()
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Add loading class to body to hide other content during animation
    document.body.classList.add('loading-screen-active')

    // Animation duration - matches CSS keyframes timing
    const timer = setTimeout(() => {
      setIsVisible(false)
      document.body.classList.remove('loading-screen-active')
      onComplete()
    }, 2500) // 2.5 sekunder

    return () => {
      clearTimeout(timer)
      document.body.classList.remove('loading-screen-active')
    }
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div
      className="loading-screen-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'white !important',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#0a0a0a'
      }}
    >
      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        {/* Base logo */}
        <img
          src={tenantLogo || "/logo/59b3f6b6c3c46621b356d5f49bb6efe368efa9ad.png"}
          alt="Logo"
          style={{
            width: '200px',
            height: '50px',
            objectFit: 'contain',
            opacity: 0.2
          }}
          onError={(e) => {
            e.currentTarget.src = '/placeholder-logo.png'
          }}
        />

        {/* Animated logo overlay */}
        <img
          src={tenantLogo || "/logo/59b3f6b6c3c46621b356d5f49bb6efe368efa9ad.png"}
          alt="Logo"
          style={{
            width: '200px',
            height: '50px',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
            left: 0,
            clipPath: 'inset(0 0 0 0)',
            animation: 'logoReveal 2s ease-in-out'
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      {/* Progress bar */}
      <div style={{
        width: '200px',
        height: '4px',
        backgroundColor: '#f0f0f0', // Lys grå baggrund for ufyldt del
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '2rem'
      }}>
        <div style={{
          height: '100%',
          width: '100%', // Start fyldt for at vise animation
          backgroundColor: tenant?.primary_color || '#007bff', // Client primary color for fyldt del (fallback blue)
          transform: 'scaleX(0)',
          transformOrigin: 'left center',
          animation: 'progressFill 2.5s ease-in-out forwards'
        }} />
      </div>

      <style jsx>{`
        @keyframes logoReveal {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0% 0 0); }
        }

        @keyframes progressFill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  )
}
