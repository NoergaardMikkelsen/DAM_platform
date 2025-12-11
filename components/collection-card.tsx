"use client"

import { useState, useEffect } from "react"
import { Heart } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

interface CollectionCardProps {
  id: string
  label: string
  assetCount: number
  previewAssets: Array<{
    id: string
    title: string
    storage_path: string
    mime_type: string
    thumbnail_path?: string | null
  }>
}

export function CollectionCard({ id, label, assetCount, previewAssets }: CollectionCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])

  useEffect(() => {
    const fetchImageUrls = async () => {
      const supabase = createClient()
      const urls: string[] = []

      for (const asset of previewAssets.slice(0, 4)) {
        if (asset.storage_path) {
          try {
            // For video files, use thumbnail if available, otherwise placeholder
            if (asset.mime_type.startsWith("video/")) {
              if (asset.thumbnail_path) {
                // Clean path - remove leading/trailing slashes
                const cleanThumbnailPath = asset.thumbnail_path.replace(/^\/+|\/+$/g, "")
                const { data, error } = await supabase.storage
                  .from('assets')
                  .createSignedUrl(cleanThumbnailPath, 3600) // 1 hour expiry

                if (error) throw error
                urls.push(data.signedUrl)
              } else {
                urls.push("/placeholder.jpg")
              }
            } else {
              // Clean path - remove leading/trailing slashes
              const cleanPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
              const { data, error } = await supabase.storage
                .from('assets')
                .createSignedUrl(cleanPath, 3600) // 1 hour expiry

              if (error) throw error
              urls.push(data.signedUrl)
            }
          } catch (error) {
            urls.push("/placeholder.jpg")
          }
        } else {
          urls.push("/placeholder.jpg")
        }
      }

      // Fill remaining slots with placeholder
      while (urls.length < 4) {
        urls.push("/placeholder.jpg")
      }

      setImageUrls(urls)
    }

    if (previewAssets.length > 0) {
      fetchImageUrls()
    }
  }, [previewAssets])

  return (
    <Link href={`/assets/collections/${id}`}>
      <div className="relative w-full min-w-[200px] aspect-[239/200] overflow-hidden rounded-lg bg-gray-100">
        {/* Simple grid layout with 4 images */}
        <div className="grid grid-cols-2 grid-rows-2 h-full">
          <div className="bg-cover bg-center" style={{ backgroundImage: `url(${imageUrls[0] || "/placeholder.jpg"})` }} />
          <div className="bg-cover bg-center" style={{ backgroundImage: `url(${imageUrls[1] || "/placeholder.jpg"})` }} />
          <div className="bg-cover bg-center" style={{ backgroundImage: `url(${imageUrls[2] || "/placeholder.jpg"})` }} />
          <div className="bg-cover bg-center" style={{ backgroundImage: `url(${imageUrls[3] || "/placeholder.jpg"})` }} />
        </div>

        {/* Overlay with collection info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-semibold text-white text-lg">{label}</h3>
          <p className="text-sm text-white/80">{assetCount} assets</p>
        </div>

        {/* Heart button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            setIsLiked(!isLiked)
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 opacity-0 transition-opacity hover:bg-white hover:text-[#dc3545] group-hover:opacity-100"
        >
          <Heart className={`h-4 w-4 ${isLiked ? "fill-current text-[#dc3545]" : ""}`} />
        </button>
      </div>
    </Link>
  )
}