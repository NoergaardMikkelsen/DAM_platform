import { redirect } from "next/navigation"

export default function TenantRootPage() {
  // Redirect root route to dashboard for tenant subdomains
  redirect("/dashboard")
}

