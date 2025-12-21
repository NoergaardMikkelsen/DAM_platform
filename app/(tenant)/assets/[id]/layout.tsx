import type { ReactNode } from "react"
import { BrandProvider } from "@/lib/context/brand-context"

export default function AssetDetailLayout({ children }: { children: ReactNode }) {
  // Only apply special layout for asset detail pages, not for collections
  return (
    <BrandProvider>
      {children}
    </BrandProvider>
  )
}

