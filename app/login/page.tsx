import { Suspense } from "react"
import { headers } from "next/headers"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  // Get host from server-side headers to avoid hydration mismatch
  const headersList = await headers()
  const hostname = headersList.get('host') || ''

  // Remove port if present
  const [host] = hostname.split(':')

  // Only log in development and when referrer is present (indicating redirect)
  if (process.env.NODE_ENV === 'development' && headersList.get('referer')) {
    console.log('[LOGIN PAGE] Server-side host:', hostname, 'Host without port:', host, 'Referrer:', headersList.get('referer'))
  }

  // Detect context for fallback
  const isSystemAdmin = host === 'admin.brandassets.space' ||
    host === 'admin.localhost' ||
    host.startsWith('admin.localhost:')

  // SERVER-SIDE TENANT DETECTION (kun for tenant subdomains)
  let tenant = null
  if (!isSystemAdmin) {
    // Extract tenant slug from hostname
    let tenantSlug = null
    if (host.endsWith('.brandassets.space')) {
      tenantSlug = host.replace('.brandassets.space', '')
    } else if (host.endsWith('.localhost')) {
      tenantSlug = host.replace('.localhost', '')
    }

    if (tenantSlug && tenantSlug !== 'www') {
      try {
        // Use server-side Supabase client (bypasses RLS for service role)
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()

        const { data, error } = await supabase
          .from("clients")
          .select("name, logo_url, primary_color")
          .eq("slug", tenantSlug)
          .eq("status", "active")
          .single()

        if (data && !error) {
          tenant = data
        }
      } catch (error) {
        console.error('Server-side tenant loading failed:', error)
      }
    }
  }

  return (
    <Suspense fallback={
      <div className={`flex min-h-screen w-full items-center justify-center p-6 ${isSystemAdmin ? 'bg-white' : 'bg-gray-50'}`}>
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            {tenant?.logo_url ? (
              <div className="mb-4">
                <img
                  src={tenant.logo_url}
                  alt={`${tenant.name} Logo`}
                  className="h-12 mx-auto object-contain"
                />
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {tenant?.name || 'Digital Asset Management'}
              </h1>
            )}
            <p className="mt-2 text-sm text-gray-600">
              {tenant ? `Sign in to ${tenant.name}` : 'Sign in to your account'}
            </p>
          </div>
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="text-2xl font-bold mb-2">Login</div>
            <div className="text-sm text-gray-600 mb-6">Enter your email below to login to your account</div>
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginForm isSystemAdmin={isSystemAdmin} tenant={tenant} />
    </Suspense>
  )
}
