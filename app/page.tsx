import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight } from "lucide-react"

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
  if (hostWithoutPort.endsWith('.localhost') && hostWithoutPort !== 'admin.localhost' && hostWithoutPort !== 'localhost') {
    redirect("/dashboard")
  }

  if (hostWithoutPort.endsWith('.brandassets.space') && hostWithoutPort !== 'admin.brandassets.space' && hostWithoutPort !== 'brandassets.space') {
    redirect("/dashboard")
  }

  // Landing page - only shown on main domain
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#6d293a' }}>
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-start">
          <a href="https://www.nmic.dk/" target="_blank" rel="noopener noreferrer">
            <Image
              src="/logo/NM_LOGO_ONE_2025_WhiteRed_RGB.svg"
              alt="Nørgård Mikkelsen"
              width={128}
              height={32}
              className="h-auto w-24 md:w-32"
              priority
            />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-start container mx-auto px-4 py-16">
        <div className="max-w-4xl">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-snug group cursor-pointer">
            <span className="inline md:block">Vi forløser{" "}
            <span style={{ color: '#df475c' }}>det fulde</span>{" "}
            </span>
            <span className="inline md:block">
              DAM-potentiale
              <Image
                src="/logo/NM_PIL2024_ROED (2).svg"
                alt="Pil"
                width={20}
                height={20}
                className="inline-block w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 ml-1 md:ml-2 align-baseline transition-transform duration-700 ease-in-out group-hover:rotate-[360deg]"
              />
            </span>
          </h1>
          
          {/* DAM System Section */}
          <div className="mt-12 mb-16">
            <p className="text-base md:text-lg text-white mb-6 max-w-2xl">
              Nørgård Mikkelsen tilbyder et professionelt DAM system til administration af jeres digitale aktiver.
              Systemet er udviklet af os og hjælper jer med at organisere, finde og dele jeres digitale indhold effektivt.
            </p>
            <p className="text-base md:text-lg text-white mb-6 max-w-2xl">
              Er du interesseret i at få adgang til systemet og høre mere om, hvordan det kan styrke jeres digitale arbejdsgange?
            </p>
            <p className="text-lg md:text-xl font-semibold mb-8" style={{ color: '#df475c' }}>
              Gør det noget, det virker?
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto">
        {/* Top Section - Dark Red Background */}
        <div style={{ backgroundColor: '#6d293a' }} className="py-8 md:py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 text-white">
              {/* Contact Information */}
              <div className="text-center md:text-left">
                <h3 className="text-lg md:text-xl font-bold mb-4">Kontakt os</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm md:text-base font-bold mb-1">Telefon</p>
                    <a href="tel:+4570202065" className="text-base md:text-lg hover:opacity-80 transition-opacity block">
                      +45 7020 2065
                    </a>
                  </div>
                  <div>
                    <p className="text-sm md:text-base font-bold mb-1">Email</p>
                    <a href="mailto:info@nmic.dk" className="text-base md:text-lg hover:opacity-80 transition-opacity block break-all">
                      info@nmic.dk
                    </a>
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div className="text-center md:text-left">
                <h3 className="text-lg md:text-xl font-bold mb-4">Lokationer</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-base md:text-lg font-bold mb-1">Odense</p>
                    <p className="text-sm md:text-base">Sverigesgade 8, 5000 Odense C</p>
                  </div>
                  <div>
                    <p className="text-base md:text-lg font-bold mb-1">København</p>
                    <p className="text-sm md:text-base">Palægade 2, 1261 København K</p>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="text-center md:text-left">
                <h3 className="text-lg md:text-xl font-bold mb-4">Følg os</h3>
                <div className="flex items-center justify-center space-x-6">
                  <a
                    href="https://www.facebook.com/nmic.dk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:opacity-80 transition-opacity"
                    aria-label="Facebook"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 264 512" aria-hidden="true">
                      <path d="M76.7 512V283H0v-91h76.7v-71.7C76.7 42.4 124.3 0 193.8 0c33.3 0 61.9 2.5 70.2 3.6V85h-48.2c-37.8 0-45.1 18-45.1 44.3V192H256l-11.7 91h-73.6v229"></path>
                    </svg>
                  </a>
                  <a
                    href="https://www.linkedin.com/company/norgard-mikkelsen/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:opacity-80 transition-opacity"
                    aria-label="LinkedIn"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 448 512" aria-hidden="true">
                      <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"></path>
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/noergaardmikkelsen/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:opacity-80 transition-opacity"
                    aria-label="Instagram"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 448 512" aria-hidden="true">
                      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"></path>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - White Background */}
        <div className="bg-white py-6 md:py-8">
          <div className="mx-auto px-4" style={{ maxWidth: '80rem' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-sm md:text-base text-center" style={{ color: '#505050' }}>
              <Link href="https://www.nmic.dk/cookiepolitik" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity block py-2 md:py-0">Cookiepolitik</Link>
              <Link href="https://www.nmic.dk/privatlivspolitik" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity block py-2 md:py-0">Privatlivspolitik</Link>
              <Link href="https://www.nmic.dk/forretningsbetingelser" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity block py-2 md:py-0">Forretningsbetingelser</Link>
              <Link href="https://www.nmic.dk/handelsbetingelser" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity block py-2 md:py-0">Handelsbetingelser</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
