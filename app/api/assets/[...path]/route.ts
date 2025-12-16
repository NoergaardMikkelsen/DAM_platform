import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const debugLog: string[] = []
  debugLog.push(`[ASSETS-API] Starting GET request`)
  
  // Log Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  debugLog.push(`[ASSETS-API] Supabase URL: ${supabaseUrl || 'MISSING'}`)
  debugLog.push(`[ASSETS-API] Supabase URL (first 30 chars): ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'N/A'}`)

  try {
    // Use regular client for auth and database queries (with RLS)
    const supabase = await createClient()
    
    // Create service role client for storage operations (bypasses RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      debugLog.push(`[ASSETS-API] ERROR: SUPABASE_SERVICE_ROLE_KEY not set`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    
    const supabaseStorage = createSupabaseClient(
      supabaseUrl!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    debugLog.push(`[ASSETS-API] Created service role client for storage operations`)
    
    // Try to list all buckets to verify connection (using service role)
    debugLog.push(`[ASSETS-API] Listing all buckets (using service role)...`)
    const { data: buckets, error: bucketsError } = await supabaseStorage.storage.listBuckets()
    if (bucketsError) {
      debugLog.push(`[ASSETS-API] Error listing buckets: ${bucketsError.message}`)
    } else {
      debugLog.push(`[ASSETS-API] Found ${buckets?.length || 0} buckets: ${buckets?.map(b => b.name).join(', ') || 'none'}`)
    }

    // Get the authenticated user
    debugLog.push(`[ASSETS-API] Getting authenticated user...`)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      debugLog.push(`[ASSETS-API] Auth error: ${authError.message}`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
    }

    debugLog.push(`[ASSETS-API] User: ${user ? `found (id: ${user.id})` : 'not found'}`)

    if (authError || !user) {
      debugLog.push(`[ASSETS-API] Unauthorized - no user`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Await params and reconstruct the storage path
    const resolvedParams = await params
    const storagePath = resolvedParams.path.join('/')
    debugLog.push(`[ASSETS-API] Raw path array: ${JSON.stringify(resolvedParams.path)}`)
    debugLog.push(`[ASSETS-API] Storage path: ${storagePath}`)

    // First, find the asset in database to get the actual client_id
    // Storage path's first part might not be client_id (could be folder UUID)
    debugLog.push(`[ASSETS-API] Looking up asset in database with storage_path matching: ${storagePath}`)
    const { data: assetData, error: assetLookupError } = await supabase
      .from('assets')
      .select('id, client_id, storage_path, title')
      .eq('storage_path', storagePath)
      .maybeSingle()
    
    if (assetLookupError) {
      debugLog.push(`[ASSETS-API] Asset lookup error: ${assetLookupError.message}`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Asset lookup failed' }, { status: 500 })
    }
    
    if (!assetData) {
      debugLog.push(`[ASSETS-API] No asset found in DB with storage_path: ${storagePath}`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    debugLog.push(`[ASSETS-API] Found asset in DB: id=${assetData.id}, client_id=${assetData.client_id}, title=${assetData.title}`)
    debugLog.push(`[ASSETS-API] DB storage_path: ${assetData.storage_path}`)
    debugLog.push(`[ASSETS-API] Requested path: ${storagePath}`)
    debugLog.push(`[ASSETS-API] Paths match: ${assetData.storage_path === storagePath}`)

    // Use the actual client_id from the asset record
    const clientId = assetData.client_id
    debugLog.push(`[ASSETS-API] Using client_id from asset record: ${clientId}`)

    // Check if user has access to this client
    debugLog.push(`[ASSETS-API] Checking user access to client ${clientId}...`)
    const { data: accessCheck, error: accessError } = await supabase
      .from('client_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .maybeSingle()

    if (accessError) {
      debugLog.push(`[ASSETS-API] Access check error: ${accessError.message}`)
    }

    debugLog.push(`[ASSETS-API] Access check result: ${accessCheck ? 'granted' : 'denied'}`)

    if (accessError || !accessCheck) {
      debugLog.push(`[ASSETS-API] Access denied`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Use 'assets' bucket with the full storage_path
    // Storage path format: f28ad255-dd2a-4869-a538-697adc4ce243/1765481543047-o4vbbb.png
    // Where f28ad255-dd2a-4869-a538-697adc4ce243 is a folder inside the 'assets' bucket
    debugLog.push(`[ASSETS-API] Using bucket: assets`)
    debugLog.push(`[ASSETS-API] Storage path: ${storagePath}`)

    // First, list root of bucket to see what folders exist (using service role)
    debugLog.push(`[ASSETS-API] Listing root folders in assets bucket (using service role)...`)
    const { data: rootListData, error: rootListError } = await supabaseStorage.storage
      .from('assets')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })
    
    if (rootListError) {
      debugLog.push(`[ASSETS-API] Root list error: ${rootListError.message}`)
    } else {
      debugLog.push(`[ASSETS-API] Found ${rootListData?.length || 0} items in root`)
      if (rootListData && rootListData.length > 0) {
        const folders = rootListData.filter(item => !item.name.includes('.'))
        const files = rootListData.filter(item => item.name.includes('.'))
        debugLog.push(`[ASSETS-API] Root folders: ${folders.slice(0, 10).map(f => f.name).join(', ')}`)
        debugLog.push(`[ASSETS-API] Root files: ${files.slice(0, 5).map(f => f.name).join(', ')}`)
      }
    }

    // Try to list files in the folder from storage_path (using service role)
    const pathFolder = storagePath.split('/')[0]
    debugLog.push(`[ASSETS-API] Listing files in storage_path folder: ${pathFolder}/ (using service role)`)
    const { data: pathListData, error: pathListError } = await supabaseStorage.storage
      .from('assets')
      .list(pathFolder, {
        limit: 10,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })
    
    if (pathListError) {
      debugLog.push(`[ASSETS-API] Path list error: ${pathListError.message}`)
    } else {
      debugLog.push(`[ASSETS-API] Found ${pathListData?.length || 0} files in storage_path folder`)
      if (pathListData && pathListData.length > 0) {
        debugLog.push(`[ASSETS-API] Sample files: ${pathListData.slice(0, 3).map(f => f.name).join(', ')}`)
      }
    }

    // Get signed URL from Supabase using 'assets' bucket and full storage_path (using service role)
    debugLog.push(`[ASSETS-API] Creating signed URL for bucket: assets, path: ${storagePath} (using service role)`)
    const { data, error } = await supabaseStorage.storage
      .from('assets')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (error) {
      debugLog.push(`[ASSETS-API] Error creating signed URL: ${error.message}`)
      debugLog.push(`[ASSETS-API] Error details: ${JSON.stringify(error)}`)
      
      
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Asset not found', details: error.message }, { status: 404 })
    }

    debugLog.push(`[ASSETS-API] Signed URL created successfully`)
    debugLog.push(`[ASSETS-API] Fetching asset from signed URL...`)

    // Fetch the asset from Supabase
    const assetResponse = await fetch(data.signedUrl)

    if (!assetResponse.ok) {
      debugLog.push(`[ASSETS-API] Failed to fetch asset: ${assetResponse.status} ${assetResponse.statusText}`)
      console.error('[ASSETS-API DEBUG]', debugLog.join('\n'))
      return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
    }

    debugLog.push(`[ASSETS-API] Asset fetched successfully, size: ${assetResponse.headers.get('content-length') || 'unknown'}`)

    // Get the asset content
    const assetBlob = await assetResponse.blob()
    
    debugLog.push(`[ASSETS-API] Asset blob created, type: ${assetBlob.type}, size: ${assetBlob.size}`)
    console.log('[ASSETS-API DEBUG]', debugLog.join('\n'))

    // Return the asset with proper headers
    const response = new NextResponse(assetBlob, {
      status: 200,
      headers: {
        'Content-Type': assetResponse.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': assetResponse.headers.get('content-length') || '',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*', // Allow from any origin since we handle auth
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })

    return response
  } catch (error) {
    console.error('Asset proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
