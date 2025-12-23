/**
 * Utility to sync Supabase session across subdomains
 * This ensures cookies are set with the correct domain (.localhost or .brandassets.space)
 */
export async function syncSessionAcrossSubdomains(supabase: any) {
  // Session sync is now optional - user data comes from server-side context
  // This function is kept for backwards compatibility and better UX
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // Try to refresh session to ensure it's valid across subdomains
      await supabase.auth.refreshSession()
    }

    return true
  } catch (error) {
    // Don't log errors - session sync is not critical anymore
    return false
  }
}

