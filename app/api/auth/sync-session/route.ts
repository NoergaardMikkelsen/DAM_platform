import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json()

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "Missing tokens" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
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

