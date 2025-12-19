/**
 * Utility to sync Supabase session across subdomains
 * This ensures cookies are set with the correct domain (.localhost or .brandassets.space)
 */
export async function syncSessionAcrossSubdomains(supabase: any) {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('[SESSION-SYNC] Error getting session:', sessionError)
      return false
    }

    if (!session) {
      // No session to sync
      return false
    }

    // Use API route to sync session with correct cookie domain
    try {
      const response = await fetch('/api/auth/sync-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[SESSION-SYNC] API sync failed:', error)
        return false
      }

      await response.json()
      return true
    } catch (apiError) {
      console.error('[SESSION-SYNC] API call failed:', apiError)
      
      // Fallback: Try to set cookies manually
      const cookieDomain = process.env.NODE_ENV === 'production' ? '.brandassets.space' : '.localhost'
      
      if (typeof document !== 'undefined') {
        // Get all Supabase auth cookies
        const cookies = document.cookie.split(';')
        cookies.forEach(cookie => {
          const [name, value] = cookie.trim().split('=')
          if (name && (name.includes('auth') || name.includes('supabase') || name.includes('sb-'))) {
            // Set cookie with correct domain
            document.cookie = `${name}=${value}; domain=${cookieDomain}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
          }
        })
      }

      // Refresh session
      const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.error('[SESSION-SYNC] Error refreshing session:', refreshError)
        return false
      }

      return true
    }
  } catch (error) {
    console.error('[SESSION-SYNC] Unexpected error:', error)
    return false
  }
}

