import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BrandProvider } from "@/lib/context/brand-context"

export default async function AssetDetailLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

  if (!userData) {
    redirect("/login")
  }

  return (
    <BrandProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[#f5f5f6]">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </BrandProvider>
  )
}

