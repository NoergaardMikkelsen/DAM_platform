import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, targetDomain } = body

    if (!userId || !targetDomain) {
      return NextResponse.json(
        { error: "Missing userId or targetDomain" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Bridge functionality is handled by sync-session route
    // This endpoint can be used for validation or forwarding
    return NextResponse.json({
      success: true,
      message: "Use /api/auth/sync-session with bridgeUserId instead",
      userId,
      targetDomain
    })
  } catch (error) {
    console.error('[BRIDGE-API] Error:', error)
    return NextResponse.json(
      { error: "Failed to process bridge request" },
      { status: 500 }
    )
  }
}
