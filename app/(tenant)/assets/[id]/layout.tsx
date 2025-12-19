import type { ReactNode } from "react"
import { BrandProvider } from "@/lib/context/brand-context"

export default function AssetDetailLayout({ children }: { children: ReactNode }) {
  // Authentication is already handled by parent tenant layout
  // This layout only provides the BrandProvider and styling wrapper
  return (
    <BrandProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[#f5f5f6]">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </BrandProvider>
  )
}

