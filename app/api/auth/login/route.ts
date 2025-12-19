import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Sign in with password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (!data.session) {
      return NextResponse.json(
        { error: "No session created" },
        { status: 400 }
      )
    }

    // Get cookies that were set by Supabase
    const cookieStore = await cookies()
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.brandassets.space' : '.localhost'
    
    // Get all cookies BEFORE we set new ones
    const allCookiesBefore = cookieStore.getAll()
    
    // Create response with cookies set with correct domain
    const response = NextResponse.json({
      success: true,
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })

    // Get all auth cookies and re-set them with correct domain
    const authCookies = allCookiesBefore.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('supabase') || 
      c.name.includes('sb-')
    )

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

    // Also set the session tokens explicitly
    if (data.session.access_token && data.session.refresh_token) {
      response.cookies.set('sb-auth-token', JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }), {
        domain: cookieDomain,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      })
    }

    return response
  } catch (error) {
    console.error('[LOGIN-API] Unexpected error:', error)
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    )
  }
}
