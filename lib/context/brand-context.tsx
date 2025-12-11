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
    async function loadClient() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Get user's first client
        const { data: clientUsers } = await supabase
          .from("client_users")
          .select(`clients(*)`)
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)

        if (clientUsers?.[0]?.clients) {
          setClient(clientUsers[0].clients as Client)

          // Apply brand colors to CSS variables
          const clientData = clientUsers[0].clients as Client
          document.documentElement.style.setProperty("--brand-primary", clientData.primary_color)
          document.documentElement.style.setProperty("--brand-secondary", clientData.secondary_color)
        }
      } catch (error) {
        console.error("Error loading client:", error)
      } finally {
        setLoading(false)
      }
    }

    loadClient()
  }, [supabase])

  return <BrandContext.Provider value={{ client, loading }}>{children}</BrandContext.Provider>
}

export function useBrand() {
  return useContext(BrandContext)
}
