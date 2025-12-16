import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Reconstruct the storage path
    const storagePath = params.path.join('/')

    // Verify user has access to this asset's client
    const pathParts = storagePath.split('/')
    const clientId = pathParts[0] // First part should be client_id

    if (!clientId) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Check if user has access to this client
    const { data: accessCheck, error: accessError } = await supabase
      .from('client_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single()

    if (accessError || !accessCheck) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get signed URL from Supabase
    const { data, error } = await supabase.storage
      .from('assets')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error)
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Fetch the asset from Supabase
    const assetResponse = await fetch(data.signedUrl)

    if (!assetResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
    }

    // Get the asset content
    const assetBlob = await assetResponse.blob()

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
