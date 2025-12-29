import React, { type ReactNode } from "react"
import { BrandProvider } from "@/lib/context/brand-context"

export default function CollectionsLayout({ children }: { children: ReactNode }) {
  // Apply brand context for collections pages
  return (
    <BrandProvider>
      {children}
    </BrandProvider>
  )
}