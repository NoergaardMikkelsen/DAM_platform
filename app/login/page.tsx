import { headers } from "next/headers"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  // Detect context on server side to avoid hydration mismatch
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isSystemAdmin = host === 'admin.brandassets.space' ||
    host === 'admin.localhost' ||
    host.startsWith('admin.localhost:')

  return (
    <LoginForm isSystemAdmin={isSystemAdmin} />
  )
}
