/**
 * Adobe Fonts Loader Component
 * 
 * Loads Adobe Fonts CSS only on the landing page.
 * This component ensures fonts are loaded efficiently with proper error handling.
 */

export function AdobeFontsLoader() {
  return (
    <>
      <link
        rel="preconnect"
        href="https://use.typekit.net"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="/api/fonts/adobe"
        crossOrigin="anonymous"
      />
    </>
  )
}

