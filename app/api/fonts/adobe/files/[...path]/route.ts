import { NextRequest, NextResponse } from 'next/server'

const ADOBE_FONTS_API_TOKEN = process.env.ADOBE_FONTS_API_TOKEN || 'gtv6qgd'

/**
 * Adobe Fonts File Proxy Route
 * Proxies individual font files (woff2, woff, etc.) from Adobe Fonts CDN
 * This ensures fonts are served through our domain for better caching and control
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    if (!ADOBE_FONTS_API_TOKEN) {
      return NextResponse.json(
        { error: 'Adobe Fonts API token not configured' },
        { status: 500 }
      )
    }

    const { path } = await params
    const fontPath = path.join('/')

    if (!fontPath) {
      return NextResponse.json(
        { error: 'Font path is required' },
        { status: 400 }
      )
    }

    // Construct Adobe Fonts CDN URL
    const possibleUrls = [
      `https://use.typekit.net/${ADOBE_FONTS_API_TOKEN}/${fontPath}`,
      `https://use.typekit.com/${ADOBE_FONTS_API_TOKEN}/${fontPath}`,
    ]

    let fontData: ArrayBuffer | null = null
    let contentType: string | null = null
    let lastError: Error | null = null

    // Try each URL until one works
    for (const url of possibleUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Next.js Adobe Fonts Proxy)',
            'Referer': `https://use.typekit.net/${ADOBE_FONTS_API_TOKEN}.css`,
            'Accept': 'font/woff2,font/woff,application/font-woff2,application/font-woff,*/*',
          },
          next: {
            revalidate: 31536000, // Cache fonts for 1 year (fonts don't change)
          },
        })

        if (response.ok) {
          fontData = await response.arrayBuffer()
          contentType = response.headers.get('content-type') || 
            (fontPath.endsWith('.woff2') ? 'font/woff2' :
             fontPath.endsWith('.woff') ? 'font/woff' :
             'application/octet-stream')
          break // Success, exit loop
        }
      } catch (error) {
        lastError = error as Error
        continue // Try next URL
      }
    }

    if (!fontData) {
      console.error('[ADOBE-FONTS-PROXY] Failed to fetch font file:', fontPath, lastError)
      return NextResponse.json(
        { error: 'Font file not found' },
        { status: 404 }
      )
    }

    // Return font file with appropriate headers
    return new NextResponse(fontData, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'font/woff2',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('[ADOBE-FONTS-PROXY] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

