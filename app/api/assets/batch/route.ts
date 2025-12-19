import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { storagePaths, assetIds } = await request.json()

    if ((!Array.isArray(storagePaths) || storagePaths.length === 0) && 
        (!Array.isArray(assetIds) || assetIds.length === 0)) {
      return NextResponse.json({ error: 'No storage paths or asset IDs provided' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user clients for access control
    const { data: clientUsers } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const clientIds = clientUsers?.map(cu => cu.client_id) || []

    // Verify asset access - batch check all assets at once
    let validAssets: Array<{ id: string; storage_path: string }> = []
    
    if (assetIds && assetIds.length > 0) {
      // If assetIds provided, use them for faster lookup
      const { data: assets } = await supabase
        .from('assets')
        .select('id, storage_path, client_id')
        .in('id', assetIds)
        .in('client_id', clientIds)
      
      validAssets = assets?.filter(a => a.storage_path) || []
    } else if (storagePaths && storagePaths.length > 0) {
      // Fallback to storage path lookup
      const { data: assets } = await supabase
        .from('assets')
        .select('id, storage_path, client_id')
        .in('storage_path', storagePaths)
        .in('client_id', clientIds)
      
      validAssets = assets?.filter(a => a.storage_path) || []
    }

    if (validAssets.length === 0) {
      return NextResponse.json({ signedUrls: {} })
    }

    // Batch create signed URLs in parallel
    const signedUrlPromises = validAssets.map(asset =>
      supabaseService.storage
        .from('assets')
        .createSignedUrl(asset.storage_path, 3600)
        .then(({ data, error }) => ({
          storagePath: asset.storage_path,
          url: data?.signedUrl || null,
          error
        }))
        .catch((error) => ({
          storagePath: asset.storage_path,
          url: null,
          error: error.message
        }))
    )

    const results = await Promise.all(signedUrlPromises)
    const signedUrls: { [key: string]: string } = {}

    results.forEach(({ storagePath, url }) => {
      if (url) {
        signedUrls[storagePath] = url
      }
    })

    return NextResponse.json({ signedUrls })
  } catch (error) {
    console.error('[BATCH-API] Batch assets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
