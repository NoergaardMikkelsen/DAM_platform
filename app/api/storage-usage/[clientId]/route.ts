import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await params

    // Verify user has access to this client
    const { data: clientAccess } = await supabase
      .from('client_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single()

    // Also check if user is superadmin
    const { data: superadminCheck } = await supabase
      .from('client_users')
      .select('roles!inner(key)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('roles.key', 'superadmin')
      .single()

    if (!clientAccess && !superadminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get service role key for Storage API access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create service role client for Storage API
    const supabaseService = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // List all files in the client's folder in the assets bucket
    // Path format: {clientId}/{fileName}
    // Handle pagination to get all files
    let allFiles: any[] = []
    let offset = 0
    const limit = 1000 // Supabase default limit
    let hasMore = true

    while (hasMore) {
      const { data: files, error: listError } = await supabaseService.storage
        .from('assets')
        .list(clientId, {
          limit,
          offset,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (listError) {
        console.error('Error listing storage files:', listError)
        return NextResponse.json(
          { error: 'Failed to list storage files', details: listError.message },
          { status: 500 }
        )
      }

      if (files && files.length > 0) {
        allFiles.push(...files)
        hasMore = files.length === limit
        offset += limit
      } else {
        hasMore = false
      }
    }

    // Supabase Storage list() doesn't return file sizes in metadata
    // We need to use database as source of truth for file sizes
    // Storage API is used to verify file count matches
    // NOTE: asset_versions includes "initial" versions that have the same storage_path as assets
    // So we should only count assets' file_size, not asset_versions, to avoid double counting
    const [assetsResult, assetVersionsResult, clientResult] = await Promise.all([
      supabase.from('assets').select('file_size, storage_path').eq('client_id', clientId).eq('status', 'active'),
      supabase.from('asset_versions').select('file_size, storage_path').eq('client_id', clientId),
      supabase.from('clients').select('storage_limit_mb').eq('id', clientId).single()
    ])
    
    // Count assets' file sizes
    const assetsBytes = assetsResult.data?.reduce((sum: number, asset: any) => sum + (asset.file_size || 0), 0) || 0
    
    // Count only asset_versions that have different storage_path than their asset
    // (i.e., versions created when replacing assets, not initial versions)
    const assetStoragePaths = new Set(assetsResult.data?.map((a: any) => a.storage_path) || [])
    const uniqueVersionsBytes = assetVersionsResult.data?.reduce((sum: number, version: any) => {
      // Only count if this version's storage_path is NOT in assets (meaning it's a replacement/update)
      if (!assetStoragePaths.has(version.storage_path)) {
        return sum + (version.file_size || 0)
      }
      return sum
    }, 0) || 0
    
    const totalBytes = assetsBytes + uniqueVersionsBytes
    
    let storageLimitMB = clientResult.data?.storage_limit_mb || 0
    
    // Migration 039 converted storage_limit_mb from MB to GB by dividing by 1024
    // So if the value is < 1000, it's likely already in GB, otherwise it's in MB
    // If it's in GB, convert to MB; if it's already in MB, use as-is
    if (storageLimitMB > 0 && storageLimitMB < 1000) {
      // Value is likely in GB (from migration), convert to MB
      storageLimitMB = storageLimitMB * 1024
    } else if (storageLimitMB <= 0) {
      // Default to 10 GB (10240 MB) if not set
      storageLimitMB = 10240
    }
    // If storageLimitMB >= 1000, it's already in MB, use as-is
    
    const storageLimitGB = storageLimitMB / 1024 // Convert MB to GB
    
    console.log(`[STORAGE-USAGE] Client ${clientId}: ${assetsResult.data?.length || 0} assets (${assetsBytes} bytes = ${(assetsBytes / 1024 / 1024).toFixed(2)} MB), ${assetVersionsResult.data?.length || 0} total versions (${uniqueVersionsBytes} bytes = ${(uniqueVersionsBytes / 1024 / 1024).toFixed(2)} MB unique versions), ${allFiles.length} files in storage, Total: ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MB = ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB), Limit: ${storageLimitMB} MB (${storageLimitGB.toFixed(2)} GB)`)

    const totalGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100

    return NextResponse.json({
      client_id: clientId,
      total_bytes: totalBytes,
      total_gb: totalGB,
      formatted: `${totalGB.toFixed(2).replace('.', ',')} GB`,
      file_count: allFiles.length,
      storage_limit_mb: storageLimitMB,
      storage_limit_gb: storageLimitGB,
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching storage usage:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch storage usage',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

