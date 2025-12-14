"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Video, FileText } from "lucide-react"

interface AssetPreviewProps {
  storagePath: string
  mimeType: string
  alt: string
  className?: string
}

export function AssetPreview({ storagePath, mimeType, alt, className }: AssetPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPreview() {
      try {
        const supabase = createClient()

        // Clean path - remove leading/trailing slashes
        const cleanPath = storagePath.replace(/^\/+|\/+$/g, "")

        const { data, error } = await supabase.storage.from("assets").createSignedUrl(cleanPath, 3600)

        if (error) throw error

        setPreviewUrl(data.signedUrl)
        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch preview:", err)
        setError(true)
        setLoading(false)
      }
    }

    fetchPreview()
  }, [storagePath])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !previewUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <span className="text-xs text-gray-400">Failed to load</span>
      </div>
    )
  }

  const isImage = mimeType.startsWith("image/")
  const isVideo = mimeType.startsWith("video/")
  const isPdf = mimeType === "application/pdf"

  if (isImage) {
    return <img src={previewUrl} alt={alt} className={className} />
  }

  if (isVideo) {
    return (
      <div className={`relative ${className}`}>
        <video
          src={previewUrl}
          className="h-full w-full object-cover"
          preload="metadata"
          muted
          playsInline
          onError={(e) => {
            console.error("Video preview error:", e)
            setError(true)
          }}
        />
        {/* Video play indicator overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="rounded-full bg-white/90 p-2">
            <Video className="h-4 w-4 text-gray-700" />
          </div>
        </div>
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className={`${className} bg-white border border-gray-200 overflow-hidden relative`}>
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitW`}
          className="w-full h-full"
          title={`PDF Preview: ${alt}`}
          style={{ border: 'none', minHeight: '300px' }}
        />
        {/* PDF overlay */}
        <div className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs px-2 py-1 rounded font-medium backdrop-blur-sm border border-gray-200">
          PDF
        </div>
      </div>
    )
  }

  // Fallback for other file types
  return (
    <div className={`flex flex-col items-center justify-center bg-gray-100 ${className}`}>
      <FileText className="h-6 w-6 text-gray-400 mb-1" />
      <span className="text-xs text-gray-500">File</span>
    </div>
  )
}

