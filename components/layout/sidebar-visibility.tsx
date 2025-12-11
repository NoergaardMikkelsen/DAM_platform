 "use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

const HIDE_PATTERNS = [/^\/assets\/[^/]+$/]

function shouldHide(pathname: string) {
  return HIDE_PATTERNS.some((re) => re.test(pathname))
}

export function SidebarVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname && shouldHide(pathname)) {
    return null
  }
  return <>{children}</>
}

