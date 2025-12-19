import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const supabase = await createClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const storagePath = decodeURIComponent(resolvedParams.path.join('/'))

    // Quick asset lookup
    const { data: assetData } = await supabase
      .from('assets')
      .select('client_id')
      .eq('storage_path', storagePath)
      .maybeSingle()

    if (!assetData) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Check access (simplified)
    const { data: superadminCheck } = await supabase
      .from('client_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('roles.key', 'superadmin')
      .limit(1)

    if (!superadminCheck || superadminCheck.length === 0) {
      const { data: accessCheck } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_id', assetData.client_id)
        .eq('status', 'active')
        .maybeSingle()

      if (!accessCheck) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Create signed URL and fetch asset
    const { data, error } = await supabaseStorage.storage
      .from('assets')
      .createSignedUrl(storagePath, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const assetResponse = await fetch(data.signedUrl)
    if (!assetResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
    }

    const assetBlob = await assetResponse.blob()

    return new NextResponse(assetBlob, {
      status: 200,
      headers: {
        'Content-Type': assetResponse.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': assetResponse.headers.get('content-length') || '',
        'Cache-Control': 'private, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })

  } catch (error) {
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
