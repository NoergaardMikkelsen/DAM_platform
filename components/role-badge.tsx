"use client"

import { Badge } from "@/components/ui/badge"

interface RoleBadgeProps {
  role: "superadmin" | "admin" | "user" | null | undefined
  isSystemAdminContext?: boolean
  className?: string
  tenantPrimaryColor?: string | null
}

/**
 * Global RoleBadge component for consistent role badge styling across admin and tenant contexts
 * 
 * Terminology:
 * - "superadmin" in system-admin context → displays as "Superadmin"
 * - "superadmin" in tenant context → displays as "Admin" (since superadmin is just an admin on a client's side)
 * - "admin" → displays as "Admin"
 * - "user" → displays as "User"
 */
export function RoleBadge({ 
  role, 
  isSystemAdminContext = false,
  className = "",
  tenantPrimaryColor = null
}: RoleBadgeProps) {

  // Determine display text and styling
  let displayText: string
  let badgeClassName: string

  if (role === "superadmin") {
    if (isSystemAdminContext) {
      // Superadmin in system-admin context - show as "Superadmin"
      displayText = "Superadmin"
      badgeClassName = "bg-red-100 text-red-800"
    } else {
      // Superadmin in tenant context - show as "Admin"
      displayText = "Admin"
      if (tenantPrimaryColor) {
        // Use tenant primary color for admin badge
        badgeClassName = "text-white"
      } else {
        badgeClassName = "bg-blue-100 text-blue-800"
      }
    }
  } else if (role === "admin") {
    displayText = "Admin"
    if (tenantPrimaryColor) {
      // Use tenant primary color for admin badge
      badgeClassName = "text-white"
    } else {
      badgeClassName = "bg-blue-100 text-blue-800"
    }
  } else if (role === "user") {
    displayText = "User"
    badgeClassName = "bg-gray-100 text-gray-800"
  } else {
    displayText = "No Access"
    badgeClassName = "bg-gray-100 text-gray-600"
  }

  return (
    <Badge
      variant="secondary"
      className={`${badgeClassName} ${className}`}
      style={tenantPrimaryColor && (role === "superadmin" || role === "admin") ? {
        backgroundColor: tenantPrimaryColor
      } : {}}
    >
      {displayText}
    </Badge>
  )
}

