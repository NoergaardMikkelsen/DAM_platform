"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Loader2, Video, FileText } from "lucide-react"

interface AssetPreviewProps {
  storagePath: string
  mimeType: string
  alt: string
  className?: string
  signedUrl?: string
  showLoading?: boolean // Control whether to show loading spinner
  onAssetLoaded?: () => void // Callback when asset is fully loaded
}

// Global batch manager to coordinate all asset loading requests
class GlobalBatchManager {
  private static instance: GlobalBatchManager
  private pendingRequests = new Map<string, { promise: Promise<string>, resolve: (url: string) => void }>()
  private loadedUrls = new Map<string, string>()
  private batchQueue: string[] = []
  private batchTimeout: NodeJS.Timeout | null = null
  private isProcessingBatch = false

  static getInstance() {
    if (!GlobalBatchManager.instance) {
      GlobalBatchManager.instance = new GlobalBatchManager()
    }
    return GlobalBatchManager.instance
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    // Return cached URL if available
    if (this.loadedUrls.has(storagePath)) {
      return this.loadedUrls.get(storagePath)!
    }

    // Return pending promise if request is already in progress
    if (this.pendingRequests.has(storagePath)) {
      return this.pendingRequests.get(storagePath)!.promise
    }

    // Create new promise for this request
    let resolveCallback: ((url: string) => void) | null = null
    const promise = new Promise<string>((resolve) => {
      resolveCallback = resolve
    })

    // Now that promise is created, we can safely store it
    this.pendingRequests.set(storagePath, { promise, resolve: resolveCallback! })
    this.addToBatch(storagePath, resolveCallback!)

    return promise
  }

  private addToBatch(storagePath: string, resolve: (url: string) => void) {
    // Add to batch queue
    if (!this.batchQueue.includes(storagePath)) {
      this.batchQueue.push(storagePath)
    }

    // Schedule batch processing
    this.scheduleBatchProcessing()
  }

  private scheduleBatchProcessing() {
    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    // Set new timeout - wait 100ms to collect more requests
    this.batchTimeout = setTimeout(() => {
      this.processPendingBatch()
    }, 100)
  }

  private async processPendingBatch() {
    if (this.isProcessingBatch || this.batchQueue.length === 0) return

    this.isProcessingBatch = true
    const paths = [...this.batchQueue]
    this.batchQueue = []

    // Processing batch

    try {
      const response = await fetch('/api/assets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePaths: paths })
      })

      if (!response.ok) {
        throw new Error(`Batch API returned ${response.status}: ${response.statusText}`)
      }

      const { signedUrls } = await response.json()
      // Got signed URLs

      // Store all returned URLs and resolve pending promises
      Object.entries(signedUrls).forEach(([path, url]) => {
        this.loadedUrls.set(path, url as string)
        const pending = this.pendingRequests.get(path)
        if (pending) {
          pending.resolve(url as string)
          this.pendingRequests.delete(path)
        }
      })

      // Resolve remaining pending requests with fallback
      paths.forEach(path => {
        if (!this.loadedUrls.has(path)) {
          console.warn('[GlobalBatchManager] No URL returned for', path)
          this.loadedUrls.set(path, '/placeholder.jpg')
        }

        const pending = this.pendingRequests.get(path)
        if (pending) {
          const url = this.loadedUrls.get(path) || '/placeholder.jpg'
          pending.resolve(url)
          this.pendingRequests.delete(path)
        }
      })

    } catch (error) {
      console.error('[GlobalBatchManager] Batch load failed:', error)

      // Resolve all pending requests with fallback
      paths.forEach(path => {
        this.loadedUrls.set(path, '/placeholder.jpg')
        const pending = this.pendingRequests.get(path)
        if (pending) {
          pending.resolve('/placeholder.jpg')
          this.pendingRequests.delete(path)
        }
      })
    } finally {
      this.isProcessingBatch = false
    }
  }
}

// Export for use in other components
export const BatchAssetLoader = GlobalBatchManager

export function AssetPreview({ storagePath, mimeType, alt, className, signedUrl, showLoading = true, onAssetLoaded }: AssetPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(signedUrl || null)
  const [loading, setLoading] = useState(!signedUrl && showLoading) // Show loading if no signedUrl and showLoading is true
  const [error, setError] = useState(false)
  const [mediaLoaded, setMediaLoaded] = useState(!!signedUrl) // Start as loaded if we have signedUrl
  const hasLoadedRef = useRef(false)

  const loadUrl = useCallback(async () => {
    // Prevent duplicate loading
    if (hasLoadedRef.current) return

    try {
      const loader = BatchAssetLoader.getInstance()
      const url = await loader.getSignedUrl(storagePath)
      if (url && url !== '/placeholder.jpg') {
        setPreviewUrl(url)
        hasLoadedRef.current = true
        // Don't set loading to false here - wait for media to actually load
      } else {
        setError(true)
        if (showLoading) setLoading(false)
      }
    } catch (err) {
      setError(true)
      if (showLoading) setLoading(false)
    }
  }, [storagePath])

  useEffect(() => {
    // Don't load if we already have a preview URL
    if (previewUrl || hasLoadedRef.current) {
      setLoading(false)
      setMediaLoaded(true)
      return
    }

    // Reset states when props change
    setError(false)
    setLoading(!signedUrl && showLoading) // Show loading if no signedUrl and showLoading is true
    setMediaLoaded(!!signedUrl)

    if (signedUrl) {
      setPreviewUrl(signedUrl)
      hasLoadedRef.current = true
      // For signed URLs, we still need to wait for media to load in the browser
      return
    }

    loadUrl()
  }, [storagePath, signedUrl, previewUrl, loadUrl, showLoading])

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
    return (
      <img
        src={previewUrl}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => {
          setMediaLoaded(true)
          onAssetLoaded?.()
        }}
        onError={() => {
          setError(true)
          setMediaLoaded(true)
          if (showLoading) setLoading(false)
        }}
      />
    )
  }

  if (isVideo) {
    return (
      <div className={`relative ${className} transition-opacity duration-300 ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <video
          src={previewUrl}
          className="h-full w-full object-cover"
          preload="metadata"
          muted
          playsInline
          onLoadedData={() => {
            setMediaLoaded(true)
            onAssetLoaded?.()
          }}
          onError={() => {
            setError(true)
            setMediaLoaded(true)
            if (showLoading) setLoading(false)
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
      <div className={`${className} bg-white border border-gray-200 overflow-hidden relative transition-opacity duration-300 ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitW`}
          className="w-full h-full"
          title={`PDF Preview: ${alt}`}
          style={{ border: 'none', minHeight: '300px' }}
          onLoad={() => {
            setMediaLoaded(true)
            onAssetLoaded?.()
          }}
          onError={() => {
            setError(true)
            setMediaLoaded(true)
            if (showLoading) setLoading(false)
          }}
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

