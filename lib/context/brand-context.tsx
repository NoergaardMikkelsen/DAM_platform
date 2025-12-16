"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Client } from "@/lib/types/database"

type BrandContextType = {
  client: Client | null
  loading: boolean
}

const BrandContext = createContext<BrandContextType>({
  client: null,
  loading: true,
})

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Default branding - layouts will override this with tenant-specific colors
    document.documentElement.style.setProperty("--brand-primary", "#000000")
    document.documentElement.style.setProperty("--brand-secondary", "#666666")
    setClient(null)
    setLoading(false)
  }, [])

  return <BrandContext.Provider value={{ client, loading }}>{children}</BrandContext.Provider>
}

export function useBrand() {
  return useContext(BrandContext)
}
