"use client"

import { createContext, useContext } from "react"

export type Tenant = {
  id: string
  name: string
  slug: string
  primary_color: string
  secondary_color: string
  domain: string | null
  logo_url?: string
  favicon_url?: string
  logo_collapsed_url?: string
}

type TenantContextType = {
  tenant: Tenant
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

interface TenantProviderProps {
  children: React.ReactNode
  tenant: Tenant | null
}

export function TenantProvider({ children, tenant }: TenantProviderProps) {
  // Fail fast if no tenant - this should never happen in production
  if (!tenant) {
    throw new Error("Tenant context required but not provided. This indicates a routing or configuration error.")
  }

  return (
    <TenantContext.Provider value={{ tenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}


