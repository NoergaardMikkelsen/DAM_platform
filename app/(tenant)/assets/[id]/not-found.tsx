"use client"

import { Button } from "@/components/ui/button"
import { FileX } from "lucide-react"
import Link from "next/link"
import { useTenant } from "@/lib/context/tenant-context"
import { getHoverColor } from "@/lib/utils/colors"

export default function AssetNotFound() {
  const { tenant } = useTenant()
  
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center p-8">
      <FileX className="mb-4 h-16 w-16 text-gray-400" />
      <h2 className="mb-2 text-2xl font-bold text-gray-900">Asset Not Found</h2>
      <p className="mb-6 text-gray-600">The asset you're looking for doesn't exist or has been removed.</p>
      <Link href="/assets">
        <Button 
          className="text-white"
          style={{ backgroundColor: tenant.primary_color || '#000000' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = getHoverColor(tenant.primary_color, '#000000')
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tenant.primary_color || '#000000'
          }}
        >
          Back to Assets
        </Button>
      </Link>
    </div>
  )
}
