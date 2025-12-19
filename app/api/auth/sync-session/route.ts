import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { access_token, refresh_token, bridgeUserId } = body

    const supabase = await createClient()

    // Handle bridge token scenario
    if (bridgeUserId && !access_token && !refresh_token) {
      // Verify the user exists and has access to this tenant
      const host = request.headers.get('host') || ''
      const subdomain = host.split('.')[0]

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', subdomain)
        .single()

      if (!client) {
        return NextResponse.json(
          { error: "Invalid tenant" },
          { status: 400 }
        )
      }

      const { data: userAccess } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', bridgeUserId)
        .eq('client_id', client.id)
        .eq('status', 'active')
        .single()

      if (!userAccess) {
        return NextResponse.json(
          { error: "No access to this tenant" },
          { status: 403 }
        )
      }

      // For bridge tokens, we'll create a temporary session
      // In production, implement proper token generation
      const tempSession = {
        access_token: `bridge-${bridgeUserId}-${Date.now()}`,
        refresh_token: `bridge-${bridgeUserId}-${Date.now()}`,
      }

      const { data, error } = await supabase.auth.setSession(tempSession)

      if (error) {
        console.error('[SYNC-SESSION] Bridge session error:', error)
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      const cookieStore = await cookies()
      const authCookies = cookieStore.getAll().filter(c =>
        c.name.includes('auth') ||
        c.name.includes('supabase') ||
        c.name.includes('sb-')
      )

      return NextResponse.json({
        success: true,
        user: data.user,
        cookiesSet: authCookies.length,
        isBridgeSession: true
      })
    }

    // Normal token sync
    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "Missing tokens" },
        { status: 400 }
      )
    }

    // Set the session using the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error) {
      console.error('[SYNC-SESSION] Error setting session:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Get cookies that were set and re-set them with correct domain
    const cookieStore = await cookies()
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.brandassets.space' : '.localhost'
    
    const authCookies = cookieStore.getAll().filter(c => 
      c.name.includes('auth') || 
      c.name.includes('supabase') || 
      c.name.includes('sb-')
    )

    // Create response with cookies set with correct domain
    const response = NextResponse.json({
      success: true,
      user: data.user,
      cookiesSet: authCookies.length,
    })

    // Re-set all auth cookies with correct domain
    authCookies.forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, {
        domain: cookieDomain,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    })

    return response
  } catch (error) {
    console.error('[SYNC-SESSION] Error:', error)
    return NextResponse.json(
      { error: "Failed to sync session" },
      { status: 500 }
    )
  }
}


