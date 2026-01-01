"use client"

import { useEffect, useState, useCallback, useRef, memo } from "react"
import { Loader2, Video, FileText } from "lucide-react"

interface AssetPreviewProps {
  storagePath: string
  mimeType: string
  alt: string
  className?: string
  style?: React.CSSProperties
  signedUrl?: string
  showLoading?: boolean // Control whether to show loading spinner
  onAssetLoaded?: () => void // Callback when asset is fully loaded
}

// Global batch manager to coordinate all asset loading requests
interface BatchRequest {
  storagePath: string
  assetId?: string
}

class GlobalBatchManager {
  private static instance: GlobalBatchManager
  private pendingRequests = new Map<string, { promise: Promise<string>, resolve: (url: string) => void }>()
  private loadedUrls = new Map<string, string>()
  private batchQueue: BatchRequest[] = []
  private assetIdMap = new Map<string, string>() // Map storagePath -> assetId
  private batchTimeout: NodeJS.Timeout | null = null
  private isProcessingBatch = false

  static getInstance() {
    if (!GlobalBatchManager.instance) {
      GlobalBatchManager.instance = new GlobalBatchManager()
    }
    return GlobalBatchManager.instance
  }

  async getSignedUrl(storagePath: string, assetId?: string): Promise<string> {
    // Return cached URL if available
    if (this.loadedUrls.has(storagePath)) {
      return this.loadedUrls.get(storagePath)!
    }

    // Store assetId mapping if provided
    if (assetId) {
      this.assetIdMap.set(storagePath, assetId)
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
    this.addToBatch(storagePath, assetId, resolveCallback!)

    return promise
  }

  // Force process batch immediately (useful for collection cards)
  forceProcessBatch(): void {
    if (this.batchQueue.length > 0 && !this.isProcessingBatch) {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout)
        this.batchTimeout = null
      }
      this.processPendingBatch()
    }
  }

  private addToBatch(storagePath: string, assetId: string | undefined, resolve: (url: string) => void) {
    // Add to batch queue if not already there
    const exists = this.batchQueue.some(req => req.storagePath === storagePath)
    if (!exists) {
      this.batchQueue.push({ storagePath, assetId })
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
    // This ensures all collection card requests are batched together
    // But also process immediately if queue is getting large (prevent delays)
    const queueSize = this.batchQueue.length
    const delay = queueSize >= 10 ? 50 : 100 // Process faster if many requests
    
    this.batchTimeout = setTimeout(() => {
      this.processPendingBatch()
    }, delay)
  }

  private async processPendingBatch() {
    if (this.isProcessingBatch || this.batchQueue.length === 0) return

    this.isProcessingBatch = true
    
    // Wait a tiny bit more to ensure all collection card requests are collected
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const requests = [...this.batchQueue]
    this.batchQueue = []

    // Extract storage paths and asset IDs
    const storagePaths = requests.map(req => req.storagePath)
    const assetIds = requests
      .map(req => req.assetId || this.assetIdMap.get(req.storagePath))
      .filter((id): id is string => !!id)


    // Retry logic for failed batches
    let retries = 0
    const maxRetries = 2
    
    while (retries <= maxRetries) {
      try {
        const response = await fetch('/api/assets/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            storagePaths,
            assetIds: assetIds.length > 0 ? assetIds : undefined
          })
        })

        if (!response.ok) {
          throw new Error(`Batch API returned ${response.status}: ${response.statusText}`)
        }

        const { signedUrls } = await response.json()

        // Store all returned URLs and resolve pending promises
        Object.entries(signedUrls || {}).forEach(([path, url]) => {
          this.loadedUrls.set(path, url as string)
          const pending = this.pendingRequests.get(path)
          if (pending) {
            pending.resolve(url as string)
            this.pendingRequests.delete(path)
          }
        })

        // Resolve remaining pending requests with fallback
        storagePaths.forEach(path => {
          if (!this.loadedUrls.has(path)) {
            // Don't set placeholder immediately - let it retry or use proxy
            const pending = this.pendingRequests.get(path)
            if (pending) {
              // Use proxy URL as fallback instead of placeholder
              pending.resolve(`/api/assets/${encodeURIComponent(path)}`)
              this.pendingRequests.delete(path)
            }
          } else {
            // Make sure all pending requests are resolved
            const pending = this.pendingRequests.get(path)
            if (pending) {
              pending.resolve(this.loadedUrls.get(path)!)
              this.pendingRequests.delete(path)
            }
          }
        })

        // Success - break out of retry loop
        break

      } catch {
        retries++
        
        if (retries > maxRetries) {
          // Final failure - resolve all with proxy URLs as fallback
          storagePaths.forEach(path => {
            const pending = this.pendingRequests.get(path)
            if (pending) {
              // Use proxy URL instead of placeholder - better than nothing
              pending.resolve(`/api/assets/${encodeURIComponent(path)}`)
              this.pendingRequests.delete(path)
            }
          })
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 200 * retries))
        }
      }
    }
    
    this.isProcessingBatch = false
    
    // Check if there are more requests queued while we were processing
    if (this.batchQueue.length > 0) {
      this.scheduleBatchProcessing()
    }
  }
}

// Export for use in other components
export const BatchAssetLoader = GlobalBatchManager

function AssetPreviewComponent({ storagePath, mimeType, alt, className, style, signedUrl, showLoading = true, onAssetLoaded }: AssetPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(signedUrl || null)
  const [loading, setLoading] = useState(false) // Never show loading for pre-loaded assets
  const [error, setError] = useState(false)
  const [mediaLoaded, setMediaLoaded] = useState(!!signedUrl) // Start as loaded if we have signedUrl
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(!!signedUrl) // Track if we've attempted to load
  const hasLoadedRef = useRef(false)

  const loadUrl = useCallback(async () => {
    // Prevent duplicate loading
    if (hasLoadedRef.current) return
    
    setHasAttemptedLoad(true) // Mark that we've attempted to load

    try {
      const loader = BatchAssetLoader.getInstance()
      const url = await loader.getSignedUrl(storagePath)
      if (url && url !== '/placeholder.jpg') {
        // Batch state updates together
        setPreviewUrl(url)
        setError(false)
        hasLoadedRef.current = true
        // Don't set loading to false here - wait for media to actually load
      } else {
        // Only show error after a delay to avoid flashing "failed to load"
        setTimeout(() => {
          setError(true)
          if (showLoading) setLoading(false)
        }, 1000) // Wait 1 second before showing error
      }
    } catch (err) {
      // Only show error after a delay to avoid flashing "failed to load"
      setTimeout(() => {
        setError(true)
        if (showLoading) setLoading(false)
      }, 1000) // Wait 1 second before showing error
    }
  }, [storagePath, showLoading])

  const handleLoad = useCallback(() => {
    setMediaLoaded(true)
    onAssetLoaded?.()
  }, [onAssetLoaded])

  const handleError = useCallback(() => {
    setError(true)
    setMediaLoaded(true)
    if (showLoading) setLoading(false)
    onAssetLoaded?.() // Call onAssetLoaded even on error so card can be shown
  }, [showLoading, onAssetLoaded])

  useEffect(() => {
    // Don't load if we already have a preview URL
    if (previewUrl || hasLoadedRef.current) {
      // Batch state updates
      setLoading(false)
      setMediaLoaded(true)
      setError(false)
      return
    }

    // Batch state resets when props change
    if (signedUrl) {
      setPreviewUrl(signedUrl)
      hasLoadedRef.current = true
      setError(false)
      setMediaLoaded(true)
      setHasAttemptedLoad(true)
      setLoading(false)
      // For signed URLs, we still need to wait for media to load in the browser
      return
    }

    // Reset states when props change - batch updates
    setError(false)
    setLoading(false)
    setMediaLoaded(false)
    setHasAttemptedLoad(false)

    loadUrl()
  }, [storagePath, signedUrl, previewUrl, loadUrl])

  // Only show loading for assets that need to load signed URLs (not pre-loaded)
  if (!previewUrl && !hasAttemptedLoad) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${className} absolute inset-0`}>
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <div className="h-2 w-16 bg-gray-300 rounded animate-pulse" />
        </div>
      </div>
    )
  }


  // Only show error if we've attempted to load AND there's an error AND we don't have a preview URL
  // Error state should also maintain size to prevent layout shift
  if (error && hasAttemptedLoad && !previewUrl) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${className} absolute inset-0`}>
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-sm text-gray-500">Failed to load</span>
        </div>
      </div>
    )
  }
  
  // If we don't have a preview URL but haven't attempted load yet, show loading
  if (!previewUrl) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${className} absolute inset-0`}>
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <div className="h-2 w-16 bg-gray-300 rounded animate-pulse" />
        </div>
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
        className={className}
        loading="lazy"
        decoding="async"
        style={{
          willChange: 'opacity',
          contain: 'layout style paint',
          ...style,
        }}
        onLoad={handleLoad}
        onError={handleError}
      />
    )
  }

  if (isVideo) {
    return (
      <div className={`relative ${className}`} style={style}>
        {/* Loading overlay that maintains size */}
        {!mediaLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <div className="h-2 w-16 bg-gray-300 rounded animate-pulse" />
            </div>
          </div>
        )}
        <video
          src={previewUrl}
          className="h-full w-full object-cover"
          preload="metadata"
          muted
          playsInline
          style={{
            willChange: 'opacity',
            ...style,
          }}
          onLoadedData={handleLoad}
          onError={handleError}
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
      <div className={`${className} bg-white border border-gray-200 overflow-hidden relative`} style={style}>
        {/* Loading overlay that maintains size */}
        {!mediaLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <div className="h-2 w-16 bg-gray-300 rounded animate-pulse" />
            </div>
          </div>
        )}
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitW`}
          className="w-full h-full"
          title={`PDF Preview: ${alt}`}
          style={{ border: 'none', minHeight: '300px', ...style }}
          onLoad={handleLoad}
          onError={handleError}
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

// Memoize component to prevent unnecessary re-renders
export const AssetPreview = memo(AssetPreviewComponent, (prevProps, nextProps) => {
  // Only re-render if critical props change
  return (
    prevProps.storagePath === nextProps.storagePath &&
    prevProps.signedUrl === nextProps.signedUrl &&
    prevProps.mimeType === nextProps.mimeType &&
    prevProps.alt === nextProps.alt &&
    prevProps.className === nextProps.className
  )
})

