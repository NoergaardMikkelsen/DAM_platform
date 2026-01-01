import { NextRequest, NextResponse } from 'next/server'

const ADOBE_FONTS_API_TOKEN = process.env.ADOBE_FONTS_API_TOKEN || 'gtv6qgd'

/**
 * Adobe Fonts API Route
 * Fetches and proxies Adobe Fonts CSS for the landing page
 * This route handles the CSS file that contains @font-face declarations
 */
export async function GET(request: NextRequest) {
  try {
    if (!ADOBE_FONTS_API_TOKEN) {
      return NextResponse.json(
        { error: 'Adobe Fonts API token not configured' },
        { status: 500 }
      )
    }

    // Adobe Fonts uses Typekit CDN
    // The token is actually a Kit ID - use it directly in the embed URL
    const possibleUrls = [
      `https://use.typekit.net/${ADOBE_FONTS_API_TOKEN}.css`,
      `https://use.typekit.com/${ADOBE_FONTS_API_TOKEN}.css`,
      // Also try with 'af' prefix (Adobe Fonts)
      `https://use.typekit.net/af/${ADOBE_FONTS_API_TOKEN}/css`,
    ]

    let css: string | null = null
    let lastError: Error | null = null

    // Try each URL until one works
    for (const url of possibleUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Next.js Adobe Fonts Proxy)',
            'Accept': 'text/css,*/*;q=0.1',
          },
          next: {
            revalidate: 86400, // Revalidate once per day
          },
        })

        if (response.ok) {
          css = await response.text()
          
          // Log for debugging (remove in production if needed)
          console.log('[ADOBE-FONTS-API] Successfully fetched CSS from:', url)
          console.log('[ADOBE-FONTS-API] CSS length:', css.length)
          console.log('[ADOBE-FONTS-API] CSS preview (first 500 chars):', css.substring(0, 500))
          
          // Rewrite font URLs in CSS to use our proxy endpoint
          // This ensures fonts are loaded through our API for better control
          css = css.replace(
            /url\((['"]?)(https?:\/\/use\.typekit\.(net|com)\/[^)]+)\1\)/gi,
            (match, quote, fontUrl) => {
              // Extract the path after the token
              const pathMatch = fontUrl.match(/\/[^/]+\/(.+)$/)
              if (pathMatch) {
                return `url(${quote}/api/fonts/adobe/files/${pathMatch[1]}${quote})`
              }
              return match
            }
          )
          
          break // Success, exit loop
        } else {
          console.warn('[ADOBE-FONTS-API] Failed to fetch from:', url, 'Status:', response.status)
        }
      } catch (error) {
        lastError = error as Error
        continue // Try next URL
      }
    }

    if (!css) {
      console.error('[ADOBE-FONTS-API] Failed to fetch CSS from all endpoints:', lastError)
      return NextResponse.json(
        { error: 'Failed to fetch Adobe Fonts CSS' },
        { status: 404 }
      )
    }

    // Return CSS with appropriate headers
    return new NextResponse(css, {
      status: 200,
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('[ADOBE-FONTS-API] Unexpected error:', error)
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

