"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

interface AssetImageProps {
  storagePath: string
  alt: string
  className?: string
}

export function AssetImage({ storagePath, alt, className }: AssetImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchImage() {
      try {
        const supabase = createClient()

        // Since assets bucket is now public, use getPublicUrl instead of signed URL
        const { data } = supabase.storage.from("assets").getPublicUrl(storagePath)

        setImageUrl(data.publicUrl)
        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch image:", err)
        setError(true)
        setLoading(false)
      }
    }

    fetchImage()
  }, [storagePath])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <span className="text-xs text-gray-400">Failed to load</span>
      </div>
    )
  }

  return <img src={imageUrl || "/placeholder.svg"} alt={alt} className={className} />
}
