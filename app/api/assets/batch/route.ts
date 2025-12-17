import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { storagePaths } = await request.json()

    if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
      return NextResponse.json({ error: 'No storage paths provided' }, { status: 400 })
    }

    console.log('[BATCH-API] Received storage paths:', storagePaths)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseService = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Use regular client for auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('[BATCH-API] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[BATCH-API] User authenticated:', user.id)

    // Get user clients for access control
    const { data: clientUsers } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const clientIds = clientUsers?.map(cu => cu.client_id) || []
    console.log('[BATCH-API] User client IDs:', clientIds)

    // Batch get signed URLs
    const signedUrls: { [key: string]: string } = {}

    for (const path of storagePaths) {
      try {
        console.log(`[BATCH-API] Processing path: ${path}`)
        // Verify asset access
        const { data: asset } = await supabase
          .from('assets')
          .select('id, client_id')
          .eq('storage_path', path)
          .single()

        if (!asset) {
          console.log(`[BATCH-API] Asset not found for path: ${path}`)
          continue
        }

        if (!clientIds.includes(asset.client_id)) {
          console.log(`[BATCH-API] Access denied for asset ${asset.id}, client ${asset.client_id}`)
          continue
        }

        console.log(`[BATCH-API] Creating signed URL for ${path}`)
        const { data, error } = await supabaseService.storage
          .from('assets')
          .createSignedUrl(path, 3600)

        if (error) {
          console.error(`[BATCH-API] Signed URL error for ${path}:`, error)
        } else if (data?.signedUrl) {
          signedUrls[path] = data.signedUrl
          console.log(`[BATCH-API] Got signed URL for ${path}`)
        }
      } catch (error) {
        console.error(`[BATCH-API] Failed to get signed URL for ${path}:`, error)
      }
    }

    console.log('[BATCH-API] Returning signed URLs:', Object.keys(signedUrls))
    return NextResponse.json({ signedUrls })
  } catch (error) {
    console.error('[BATCH-API] Batch assets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
