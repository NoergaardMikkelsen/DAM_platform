import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface SupabaseUsageResponse {
  usage: {
    storage: {
      total_bytes: number
      breakdown: Array<{
        type: string
        bytes: number
      }>
    }
  }
}

serve(async (req) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase credentials')
    }

    // Extract project reference from URL (e.g., "vgakwhwjgifbuodzrnut" from "vgakwhwjgifbuodzrnut.supabase.co")
    const projectRef = supabaseUrl.split('//')[1].split('.')[0]

    // Call Supabase Management API for usage stats
    const usageResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/usage`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!usageResponse.ok) {
      throw new Error(`Management API error: ${usageResponse.status}`)
    }

    const usageData: SupabaseUsageResponse = await usageResponse.json()

    // Calculate total storage in GB
    const totalBytes = usageData.usage.storage.total_bytes
    const totalGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100

    // Return formatted response
    return new Response(
      JSON.stringify({
        total_bytes: totalBytes,
        total_gb: totalGB,
        formatted: `${totalGB.toFixed(2).replace('.', ',')} GB`,
        breakdown: usageData.usage.storage.breakdown,
        last_updated: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300', // Cache for 5 minutes
        },
      }
    )

  } catch (error) {
    console.error('Error fetching system storage:', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch system storage',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
