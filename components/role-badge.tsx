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
    if (tenantPrimaryColor) {
      // Use tenant primary color with 50% opacity for user badge background
      // Text should remain normal color and visibility
      badgeClassName = "text-gray-800"
    } else {
      badgeClassName = "bg-gray-100 text-gray-800"
    }
  } else {
    displayText = "No Access"
    badgeClassName = "bg-gray-100 text-gray-600"
  }

  // Helper function to convert hex to rgba with opacity
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // Determine background color style
  let backgroundColorStyle: React.CSSProperties = {}
  if (tenantPrimaryColor) {
    if (role === "superadmin" || role === "admin") {
      // Admin roles get full color
      backgroundColorStyle.backgroundColor = tenantPrimaryColor
    } else if (role === "user") {
      // User role gets 50% opacity on background only (not text)
      backgroundColorStyle.backgroundColor = hexToRgba(tenantPrimaryColor, 0.5)
    }
  }

  return (
    <Badge
      variant="secondary"
      className={`${badgeClassName} ${className}`}
      style={backgroundColorStyle}
    >
      {displayText}
    </Badge>
  )
}

