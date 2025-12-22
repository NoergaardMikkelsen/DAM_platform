import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and has superadmin role
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has superadmin role
    const { data: superadminCheck } = await supabase
      .from('client_users')
      .select('roles!inner(key)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('roles.key', 'superadmin')
      .single()

    if (!superadminCheck) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    // Call Edge Function for system storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Extract project reference from URL
    const projectRef = supabaseUrl.split('//')[1].split('.')[0]

    // Call Supabase Management API
    const usageResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/usage`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!usageResponse.ok) {
      throw new Error(`Management API error: ${usageResponse.status} ${usageResponse.statusText}`)
    }

    const usageData = await usageResponse.json()

    // Calculate total storage in GB
    const totalBytes = usageData.usage?.storage?.total_bytes || 0
    const totalGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100

    return NextResponse.json({
      total_bytes: totalBytes,
      total_gb: totalGB,
      formatted: `${totalGB.toFixed(2).replace('.', ',')} GB`,
      breakdown: usageData.usage?.storage?.breakdown || [],
      last_updated: new Date().toISOString(),
      included_in_plan: "Pro Plan" // Can be made dynamic if needed
    })

  } catch (error) {
    console.error('Error fetching system storage:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch system storage',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
