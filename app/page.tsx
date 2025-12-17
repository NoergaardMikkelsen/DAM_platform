import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Shield, Zap, Users } from "lucide-react"

export default async function LandingPage() {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  
  // Remove port if present
  const [hostWithoutPort] = host.split(':')
  
  // Handle admin subdomain routing
  if (hostWithoutPort === 'admin.brandassets.space' || hostWithoutPort === 'admin.localhost') {
    // Check authentication and redirect appropriately
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Check if superadmin using the is_superadmin function
      const { data: isSuperAdmin } = await supabase.rpc('is_superadmin', {
        p_user_id: user.id
      })

      if (isSuperAdmin) {
        redirect('/system-admin/dashboard')
      } else {
        redirect('/login') // Not a superadmin
      }
    } else {
      redirect('/login') // Not authenticated
    }
  }

  // If on tenant subdomain, redirect to dashboard
  // Tenant layout will handle authentication and tenant validation
  if (hostWithoutPort.endsWith('.localhost') && hostWithoutPort !== 'admin.localhost') {
    redirect("/dashboard")
  }

  if (hostWithoutPort.endsWith('.brandassets.space') && hostWithoutPort !== 'admin.brandassets.space') {
    redirect("/dashboard")
  }

  // Landing page - only shown on main domain
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">BA</span>
            </div>
            <span className="text-xl font-bold text-gray-900">BrandAssets</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Professional Digital Asset Management
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Streamline your brand asset management with our secure, scalable platform.
            Perfect for agencies, corporations, and creative teams.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Enterprise-grade security with private asset storage and granular access controls
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Optimized for performance with automatic image optimization and CDN delivery
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Team Collaboration</CardTitle>
              <CardDescription>
                Work seamlessly with your team with real-time collaboration and approval workflows
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your asset management?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of creative professionals who trust BrandAssets for their digital asset management needs.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary">
              Get Started Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">BA</span>
            </div>
            <span className="text-gray-600">© 2024 BrandAssets. All rights reserved.</span>
          </div>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
