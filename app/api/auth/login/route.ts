import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body
    
    console.log('[LOGIN-API] Attempting login for:', email)

    if (!email || !password) {
      console.log('[LOGIN-API] Missing email or password')
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Sign in with password
    console.log('[LOGIN-API] Calling Supabase signInWithPassword...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[LOGIN-API] Supabase error:', error.message, error)
      return NextResponse.json(
        { error: error.message || 'Login failed' },
        { status: 400 }
      )
    }
    
    console.log('[LOGIN-API] Login successful for:', data.user?.email)

    if (!data.session) {
      return NextResponse.json(
        { error: "No session created" },
        { status: 400 }
      )
    }

    // Get cookies that were set by Supabase
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === 'production'
    
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

    // Re-set all auth cookies
    // For localhost: don't set domain (browser handles it)
    // For production: use .brandassets.space
    // NOTE: httpOnly must be false for Supabase client-side to read session
    authCookies.forEach(cookie => {
      // For localhost subdomains, we need to ensure cookies work across subdomains
      // But we can't set domain for localhost, so we rely on browser default behavior
      response.cookies.set(cookie.name, cookie.value, {
        ...(isProduction ? { domain: '.brandassets.space' } : {}),
        path: '/',
        httpOnly: false, // Must be false for Supabase client-side to read session
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    })
    
    // Also ensure Supabase's default auth cookies are set
    // Supabase sets these automatically, but we need to make sure they're in the response
    if (data.session.access_token) {
      // Set the access token cookie explicitly
      response.cookies.set(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`, JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
        user: data.user,
      }), {
        ...(isProduction ? { domain: '.brandassets.space' } : {}),
        path: '/',
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      })
    }

    // Also set the session tokens explicitly
    if (data.session.access_token && data.session.refresh_token) {
      response.cookies.set('sb-auth-token', JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }), {
        ...(isProduction ? { domain: '.brandassets.space' } : {}),
        path: '/',
        httpOnly: false, // Must be false for client-side Supabase
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      })
    }

    return response
  } catch (error: any) {
    console.error('[LOGIN-API] Unexpected error:', error)
    return NextResponse.json(
      { error: error?.message || "Failed to login" },
      { status: 500 }
    )
  }
}
