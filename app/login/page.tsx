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

  return (
    <Suspense fallback={
      <div className={`flex min-h-screen w-full items-center justify-center p-6 ${isSystemAdmin ? 'bg-white' : 'bg-gray-50'}`}>
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Digital Asset Management</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
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
      <LoginForm isSystemAdmin={isSystemAdmin} />
    </Suspense>
  )
}
