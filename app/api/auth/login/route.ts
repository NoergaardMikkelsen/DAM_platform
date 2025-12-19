import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:entry',message:'Login API called',data:{email:email?.substring(0,5)+'***'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:error',message:'Supabase login error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:cookies-before',message:'Cookies before setting',data:{cookieCount:allCookiesBefore.length,cookieNames:allCookiesBefore.map(c=>c.name),targetDomain:cookieDomain,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    
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

    // Log the actual Set-Cookie headers that will be sent
    const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : []
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/route.ts:success',message:'Login successful, cookies set',data:{userId:data.user?.id?.substring(0,8),cookieDomain:cookieDomain,authCookiesFound:authCookies.length,responseCookieCount:response.cookies.getAll().length,setCookieHeaderCount:setCookieHeaders.length,setCookieHeaders:setCookieHeaders.map(h=>h.substring(0,100))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion

    return response
  } catch (error) {
    console.error('[LOGIN-API] Unexpected error:', error)
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    )
  }
}
