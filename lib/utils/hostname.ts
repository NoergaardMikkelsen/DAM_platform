/**
 * Hostname and subdomain utilities
 * Pure functions that work in both client and server environments
 */

/**
 * Extract tenant subdomain from hostname
 * Supports both production (*.brandassets.space) and development (*.localhost:port)
 */
export function extractTenantSubdomain(host: string): string | null {
  // Remove port if present
  const hostWithoutPort = host.split(':')[0]

  // Production: tenant.brandassets.space
  if (hostWithoutPort.endsWith('.brandassets.space')) {
    return hostWithoutPort.replace('.brandassets.space', '')
  }

  // Development: tenant.localhost
  if (hostWithoutPort.endsWith('.localhost')) {
    return hostWithoutPort.replace('.localhost', '')
  }

  return null
}

/**
 * Check if hostname is a tenant subdomain (not admin)
 */
export function isTenantSubdomain(host: string): boolean {
  const subdomain = extractTenantSubdomain(host)
  return subdomain !== null && subdomain !== 'admin'
}

/**
 * Check if hostname is system admin subdomain
 */
export function isSystemAdminSubdomain(host: string): boolean {
  return host === 'admin.brandassets.space' ||
         host === 'admin.localhost' ||
         host.startsWith('admin.localhost:')
}