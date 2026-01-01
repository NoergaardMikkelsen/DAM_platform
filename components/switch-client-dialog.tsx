"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, Building } from "lucide-react"
import { useTenant } from "@/lib/context/tenant-context"

interface Client {
  id: string
  name: string
  slug: string
  domain: string | null
  primary_color: string
  logo_collapsed_url?: string | null
  user_count?: number
}

interface SwitchClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SwitchClientDialog({ open, onOpenChange }: SwitchClientDialogProps) {
  const { tenant } = useTenant()
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      loadUserClients()
    }
  }, [open])


  const loadUserClients = async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

      // Get all clients the user has access to
      const { data: clientUsers, error } = await supabase
        .from("client_users")
        .select(`
          *,
          clients!inner (
            id,
            name,
            slug,
            domain,
            primary_color,
            logo_collapsed_url
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("clients.status", "active")
        .order("clients(name)")

      if (error) {
        setIsLoading(false)
        return
      }

      // Get user counts for each client
      const clientsWithCounts = await Promise.all(
        (clientUsers || []).map(async (cu: any) => {
          const { count } = await supabase
            .from("client_users")
            .select("id", { count: "exact", head: true })
            .eq("client_id", cu.clients.id)
            .eq("status", "active")

          return {
            id: cu.clients.id,
            name: cu.clients.name,
            slug: cu.clients.slug,
            domain: cu.clients.domain,
            primary_color: cu.clients.primary_color,
            logo_collapsed_url: cu.clients.logo_collapsed_url,
            user_count: count || 0,
          }
        })
      )

      setClients(clientsWithCounts)
    } catch {
      // Error loading clients - silently fail
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchClient = (clientSlug: string) => {
    const isDevelopment = window.location.hostname.includes('localhost')
    const port = window.location.port || '3000'
    
    if (isDevelopment) {
      window.location.href = `http://${clientSlug}.localhost:${port}/dashboard`
    } else {
      window.location.href = `https://${clientSlug}.brandassets.space/dashboard`
    }
  }

  const handleOpenInNewTab = (clientSlug: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const isDevelopment = window.location.hostname.includes('localhost')
    const port = window.location.port || '3000'
    
    if (isDevelopment) {
      window.open(`http://${clientSlug}.localhost:${port}/dashboard`, '_blank')
    } else {
      window.open(`https://${clientSlug}.brandassets.space/dashboard`, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] [&_[data-slot=dialog-close]]:border-0 [&_[data-slot=dialog-close]]:ring-0 [&_[data-slot=dialog-close]]:focus:ring-0 [&_[data-slot=dialog-close]]:focus:ring-offset-0 [&_[data-slot=dialog-close]]:ring-offset-0">
        <DialogHeader>
          <DialogTitle>Switch client</DialogTitle>
          <DialogDescription>
            When you select a client, it opens the client's domain in a new tab.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No clients found</div>
          ) : (
            clients.map((client) => {
              const isCurrentClient = tenant?.id === client.id
              const clientDomain = client.domain || `${client.slug}.brandassets.space`

              return (
                <div
                  key={client.id}
                  onClick={() => !isCurrentClient && handleSwitchClient(client.slug)}
                  className={`
                    flex items-center justify-between p-4 rounded-lg border
                    transition-all
                    ${isCurrentClient 
                      ? 'bg-gray-50 border-gray-200 cursor-default' 
                      : 'border-gray-100 cursor-pointer hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden flex-shrink-0">
                      {client.logo_collapsed_url ? (
                        <img
                          src={client.logo_collapsed_url}
                          alt={`${client.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-600">
                          <Building className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {client.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{clientDomain}</p>
                      <p className="text-sm text-gray-500">{client.user_count || 0} members</p>
                    </div>
                  </div>
                  {isCurrentClient ? (
                    <div className="rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200" style={{ width: '32px', height: '32px' }}>
                      <Check className="h-4 w-4 text-gray-600" />
                    </div>
                  ) : (
                    <button
                      className="rounded-full flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#000000',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenInNewTab(client.slug, e)
                      }}
                      title="Open in new tab"
                    >
                      <svg
                        viewBox="0 8 25 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        preserveAspectRatio="xMidYMid"
                        style={{
                          width: '18px',
                          height: '16px',
                        }}
                      >
                        <path
                          d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                          stroke="white"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

