"use client"

import { useState, useEffect, useRef, memo, useCallback } from "react"
import { Heart } from "lucide-react"
import Link from "next/link"
import { BatchAssetLoader } from "./asset-preview"

interface CollectionCardProps {
  id: string
  label: string
  assetCount: number
  previewAssets: Array<{
    id: string
    title: string
    storage_path: string
    mime_type: string
  }>
  onLoaded?: () => void // Callback when card is fully loaded
}

function CollectionCardComponent({ id, label, assetCount, previewAssets, onLoaded }: CollectionCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>(["", "", "", ""])
  const [assetTypes, setAssetTypes] = useState<string[]>(["placeholder", "placeholder", "placeholder", "placeholder"])
  const [videoUrls, setVideoUrls] = useState<string[]>(["", "", "", ""])
  const [loadedImages, setLoadedImages] = useState<boolean[]>([false, false, false, false])
  const [urlsResolved, setUrlsResolved] = useState(false) // Track if URLs have been resolved
  const hasNotifiedLoaded = useRef(false) // Track if we've already notified parent
  const prevAssetIdsRef = useRef<string>('') // Track previous asset IDs to prevent unnecessary resets

  // Calculate how many assets we actually have (non-placeholder)
  const actualAssetCount = assetTypes.filter(type => type !== "placeholder").length
  
  // Check if card is ready to show - URLs must be resolved, media can load in background
  // This ensures all cards appear simultaneously, regardless of video/image loading speed
  const allAssetsLoaded = urlsResolved

  // Notify parent when card is fully loaded (only once)
  useEffect(() => {
    if (allAssetsLoaded && onLoaded && !hasNotifiedLoaded.current) {
      hasNotifiedLoaded.current = true
      onLoaded()
    }
  }, [allAssetsLoaded, onLoaded])

  // Optimize handleImageLoad with useCallback
  const handleImageLoad = useCallback((index: number) => {
    // Track loaded state for potential future use (currently not blocking card visibility)
    setLoadedImages(prev => {
      const newLoaded = [...prev]
      newLoaded[index] = true
      return newLoaded
    })
  }, [])

  // Timeout fallbacks removed - cards show as soon as URLs are resolved
  // Media can load in background while card is already visible

  useEffect(() => {
    
    // Check if previewAssets actually changed by comparing IDs
    const currentAssetIds = previewAssets.slice(0, 4).map(a => a?.id).filter(Boolean).join(',')
    
    // Only reset if assets actually changed
    if (prevAssetIdsRef.current !== currentAssetIds) {
      prevAssetIdsRef.current = currentAssetIds
      hasNotifiedLoaded.current = false // Reset notification flag first
      
      // Batch all state resets together to prevent multiple re-renders
      setUrlsResolved(false)
      setLoadedImages([false, false, false, false])
      setImageUrls(["", "", "", ""])
      setAssetTypes(["placeholder", "placeholder", "placeholder", "placeholder"])
      setVideoUrls(["", "", "", ""])
    }
    
    const fetchImageUrls = async () => {
      
      const loader = BatchAssetLoader.getInstance()
      
      const assetData: Array<{
        type: string
        storagePath: string
        isVideo: boolean
        isPdf: boolean
      }> = []

      const videoCount = previewAssets.filter((a: any) => a.mime_type?.startsWith("video/")).length

      // Collect all paths that need URLs
      for (const asset of previewAssets.slice(0, 4)) {
        // Ensure asset has required properties
        if (asset && asset.storage_path && asset.mime_type) {
          const cleanPath = asset.storage_path.replace(/^\/+|\/+$/g, "")

          if (asset.mime_type.startsWith("video/")) {
            assetData.push({
              type: "video",
              storagePath: cleanPath,
              isVideo: true,
              isPdf: false
            })
          } else if (asset.mime_type === "application/pdf") {
            assetData.push({
              type: "pdf",
              storagePath: cleanPath,
              isVideo: false,
              isPdf: true
            })
          } else {
            assetData.push({
              type: "image",
              storagePath: cleanPath,
              isVideo: false,
              isPdf: false
            })
          }
        } else {
          // Missing storage_path or mime_type - use placeholder
          assetData.push({
            type: "placeholder",
            storagePath: "",
            isVideo: false,
            isPdf: false
          })
        }
      }

      // Fill remaining slots with placeholder
      while (assetData.length < 4) {
        assetData.push({
          type: "placeholder",
          storagePath: "",
          isVideo: false,
          isPdf: false
        })
      }

      // Get all URLs in parallel - BatchAssetLoader handles batching automatically
      const urlPromises: Promise<string>[] = []
      const videoUrlPromises: Promise<string>[] = []
      const types: string[] = []

      for (const data of assetData) {
        if (data.type === "placeholder") {
          urlPromises.push(Promise.resolve("")) // Empty string for gray background
          videoUrlPromises.push(Promise.resolve(""))
          types.push("placeholder")
        } else {
          types.push(data.type)

          // Find the asset ID for this storage path - normalize paths for matching
          const cleanPreviewPath = data.storagePath.replace(/^\/+|\/+$/g, "")
          const asset = previewAssets.find((a: any) => {
            if (!a?.storage_path) return false
            const cleanAssetPath = a.storage_path.replace(/^\/+|\/+$/g, "")
            return cleanAssetPath === cleanPreviewPath || a.storage_path === data.storagePath
          })
          const assetId = asset?.id


          if (data.isVideo) {
            // Direct video URL for both display and playback (no thumbnail handling)
            const videoPromise = loader.getSignedUrl(data.storagePath, assetId)
              .catch(() => "")
            videoUrlPromises.push(videoPromise)
            urlPromises.push(videoPromise) // Use video URL directly for display
          } else {
            videoUrlPromises.push(Promise.resolve(""))
            urlPromises.push(
              loader.getSignedUrl(data.storagePath, assetId).catch(() => "")
            )
          }
        }
      }

      // Wait for all URLs to resolve with error handling
      // No timeout needed - URLs can load in background while card is visible
      try {
        
        const [urls, videoUrls] = await Promise.all([
          Promise.all(urlPromises),
          Promise.all(videoUrlPromises)
        ]) as [string[], string[]]


        // Batch all state updates together to prevent multiple re-renders
        // Use React's automatic batching (React 18+) - all setState calls in async callbacks are batched
        setImageUrls(urls)
        setAssetTypes(types)
        setVideoUrls(videoUrls)
        setLoadedImages([false, false, false, false])
        setUrlsResolved(true) // Mark URLs as resolved last - this triggers card visibility
        
      } catch {
        // Set empty URLs on error to prevent infinite loading - batch updates
        setImageUrls(["", "", "", ""])
        setAssetTypes(types)
        setVideoUrls(["", "", "", ""])
        setLoadedImages([false, false, false, false])
        setUrlsResolved(true) // Still mark as resolved so card can show (even if empty)
      }
    }

    // Only fetch URLs if we have valid preview assets with storage_path
    const validPreviewAssets = previewAssets.filter(a => {
      const isValid = a && a.storage_path && a.mime_type
      return isValid
    })
    
    
    if (validPreviewAssets.length > 0) {
      
      const loader = BatchAssetLoader.getInstance()
      
      // Start fetching URLs
      fetchImageUrls()
        .then(() => {
          // After URLs are fetched, force process batch to ensure they're loaded
          // This helps with timing issues where batch hasn't processed yet
          setTimeout(() => {
            loader.forceProcessBatch()
          }, 150) // Wait a bit for batch to collect, then force process
        })
        .catch(() => {
          // Still mark as resolved on error so card can show
          setUrlsResolved(true)
        })
    } else {
      // If no valid preview assets, mark as resolved immediately to show card
      setUrlsResolved(true)
    }
  }, [previewAssets, label])

  return (
    <Link href={`/assets/collections/${id}`} className="block w-full">
      <div 
        className="relative w-full aspect-[239/200] overflow-hidden" 
        style={{ 
          containerType: 'inline-size',
        }}
      >
        {/* SVG with mask for the exact shape */}
        <svg viewBox="0 0 239 200" className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Define the mask with the exact path */}
            <mask id={`cardMask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="239" height="200">
              <path
                d="M0 179V21C0 9.40202 9.40202 0 21 0H216.195C227.67 0 237.02 9.17764 237.181 20.652C237.598 50.258 238.304 103.407 238.304 123.5C238.304 152 206.152 133 188.658 156C171.163 179 193.386 200 144.499 200H20.9761C9.37811 200 0 190.598 0 179Z"
                fill="white"
              />
            </mask>

            {/* Define clipPath for buttons outside SVG */}
            <clipPath id={`cardClipPath-${id}`} clipPathUnits="userSpaceOnUse">
              <path
                d="M0 179V21C0 9.40202 9.40202 0 21 0H216.195C227.67 0 237.02 9.17764 237.181 20.652C237.598 50.258 238.304 103.407 238.304 123.5C238.304 152 206.152 133 188.658 156C171.163 179 193.386 200 144.499 200H20.9761C9.37811 200 0 190.598 0 179Z"
              />
            </clipPath>


            {/* Gradient overlays */}
            <linearGradient id={`topGradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="2%" stopColor="rgba(0, 0, 0, 0.55)" />
              <stop offset="65%" stopColor="rgba(34, 34, 34, 0.00)" />
            </linearGradient>
            <linearGradient id={`bottomGradient-${id}`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0.23%" stopColor="rgba(0, 0, 0, 0.70)" />
              <stop offset="45%" stopColor="rgba(34, 34, 34, 0.00)" />
            </linearGradient>
          </defs>

          {/* Background images with mask */}
          <g mask={`url(#cardMask-${id})`}>
            {/* 2x2 grid of images/videos - positioned based on reference */}
            {assetTypes[0] === "video" && (videoUrls[0] || imageUrls[0]) ? (
              <foreignObject 
                x="0" 
                y="0" 
                width="119.5" 
                height="95" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                {/* For videos, show thumbnail if available and different from video URL, otherwise show video */}
                {imageUrls[0] && imageUrls[0] !== videoUrls[0] && !imageUrls[0].includes('.mp4') ? (
                  <img
                    src={imageUrls[0]}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                      contain: 'layout style paint',
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      handleImageLoad(0)
                    }}
                    onError={() => {
                      // If thumbnail fails and we have video URL, show video instead
                      if (videoUrls[0]) {
                        // Force show video by clearing thumbnail URL
                        setImageUrls(prev => {
                          const newUrls = [...prev]
                          newUrls[0] = ""
                          return newUrls
                        })
                      } else {
                        handleImageLoad(0)
                      }
                    }}
                  />
                ) : videoUrls[0] ? (
                  <video
                    src={videoUrls[0]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      handleImageLoad(0)
                    }}
                    onCanPlay={() => {
                      handleImageLoad(0)
                    }}
                    onLoadedMetadata={() => {
                      handleImageLoad(0)
                    }}
                    onError={() => {
                      handleImageLoad(0)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[0] === "pdf" ? (
              <foreignObject 
                x="0" 
                y="0" 
                width="119.5" 
                height="95" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <iframe
                  src={`${imageUrls[0]}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    pointerEvents: 'none'
                  }}
                  title="PDF Preview"
                  onLoad={() => handleImageLoad(0)}
                  onError={() => handleImageLoad(0)}
                />
              </foreignObject>
            ) : assetTypes[0] === "image" ? (
              <foreignObject 
                x="0" 
                y="0" 
                width="119.5" 
                height="95" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <img
                  src={imageUrls[0]}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    willChange: 'opacity',
                    contain: 'layout style paint',
                  }}
                  alt="Asset preview"
                  crossOrigin="anonymous"
                  onLoad={() => handleImageLoad(0)}
                  onError={() => handleImageLoad(0)}
                />
              </foreignObject>
            ) : (
              <rect x="0" y="0" width="119.5" height="95" fill="#f3f4f6" />
            )}

            {assetTypes[1] === "video" && (videoUrls[1] || imageUrls[1]) ? (
              <foreignObject 
                x="119.5" 
                y="0" 
                width="119.5" 
                height="95" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                {imageUrls[1] && imageUrls[1] !== videoUrls[1] && !imageUrls[1].includes('.mp4') ? (
                  <img
                    src={imageUrls[1]}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                      contain: 'layout style paint',
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      handleImageLoad(1)
                    }}
                    onError={() => {
                      if (videoUrls[1]) {
                        setImageUrls(prev => {
                          const newUrls = [...prev]
                          newUrls[1] = ""
                          return newUrls
                        })
                      } else {
                        handleImageLoad(1)
                      }
                    }}
                  />
                ) : videoUrls[1] ? (
                  <video
                    src={videoUrls[1]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      handleImageLoad(1)
                    }}
                    onCanPlay={() => {
                      handleImageLoad(1)
                    }}
                    onLoadedMetadata={() => {
                      handleImageLoad(1)
                    }}
                    onError={() => {
                      handleImageLoad(1)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[1] === "pdf" ? (
              <foreignObject 
                x="119.5" 
                y="0" 
                width="119.5" 
                height="95" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <iframe
                  src={`${imageUrls[1]}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    pointerEvents: 'none'
                  }}
                  title="PDF Preview"
                  onLoad={() => handleImageLoad(1)}
                  onError={() => handleImageLoad(1)}
                />
              </foreignObject>
            ) : assetTypes[1] === "image" ? (
              <foreignObject 
                x="119.5" 
                y="0" 
                width="119.5" 
                height="95" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <img
                  src={imageUrls[1]}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    willChange: 'opacity',
                    contain: 'layout style paint',
                  }}
                  alt="Asset preview"
                  crossOrigin="anonymous"
                  onLoad={() => handleImageLoad(1)}
                />
              </foreignObject>
            ) : (
              <rect x="119.5" y="0" width="119.5" height="95" fill="#f3f4f6" />
            )}

            {assetTypes[2] === "video" && (videoUrls[2] || imageUrls[2]) ? (
              <foreignObject 
                x="0" 
                y="95" 
                width="119.5" 
                height="105" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                {imageUrls[2] && imageUrls[2] !== videoUrls[2] && !imageUrls[2].includes('.mp4') ? (
                  <img
                    src={imageUrls[2]}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                      contain: 'layout style paint',
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      handleImageLoad(2)
                    }}
                    onError={() => {
                      if (videoUrls[2]) {
                        setImageUrls(prev => {
                          const newUrls = [...prev]
                          newUrls[2] = ""
                          return newUrls
                        })
                      } else {
                        handleImageLoad(2)
                      }
                    }}
                  />
                ) : videoUrls[2] ? (
                  <video
                    src={videoUrls[2]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      handleImageLoad(2)
                    }}
                    onCanPlay={() => {
                      handleImageLoad(2)
                    }}
                    onLoadedMetadata={() => {
                      handleImageLoad(2)
                    }}
                    onError={() => {
                      handleImageLoad(2)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[2] === "pdf" ? (
              <foreignObject 
                x="0" 
                y="95" 
                width="119.5" 
                height="105" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <iframe
                  src={`${imageUrls[2]}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    pointerEvents: 'none'
                  }}
                  title="PDF Preview"
                  onLoad={() => handleImageLoad(2)}
                  onError={() => handleImageLoad(2)}
                />
              </foreignObject>
            ) : assetTypes[2] === "image" ? (
              <foreignObject 
                x="0" 
                y="95" 
                width="119.5" 
                height="105" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <img
                  src={imageUrls[2]}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    willChange: 'opacity',
                    contain: 'layout style paint',
                  }}
                  alt="Asset preview"
                  crossOrigin="anonymous"
                  onLoad={() => handleImageLoad(2)}
                />
              </foreignObject>
            ) : (
              <rect x="0" y="95" width="119.5" height="105" fill="#f3f4f6" />
            )}

            {assetTypes[3] === "video" && (videoUrls[3] || imageUrls[3]) ? (
              <foreignObject 
                x="119.5" 
                y="95" 
                width="119.5" 
                height="105" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                {imageUrls[3] && imageUrls[3] !== videoUrls[3] && !imageUrls[3].includes('.mp4') ? (
                  <img
                    src={imageUrls[3]}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                      contain: 'layout style paint',
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      handleImageLoad(3)
                    }}
                    onError={() => {
                      if (videoUrls[3]) {
                        setImageUrls(prev => {
                          const newUrls = [...prev]
                          newUrls[3] = ""
                          return newUrls
                        })
                      } else {
                        handleImageLoad(3)
                      }
                    }}
                  />
                ) : videoUrls[3] ? (
                  <video
                    src={videoUrls[3]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      willChange: 'opacity',
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      handleImageLoad(3)
                    }}
                    onCanPlay={() => {
                      handleImageLoad(3)
                    }}
                    onLoadedMetadata={() => {
                      handleImageLoad(3)
                    }}
                    onError={() => {
                      handleImageLoad(3)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[3] === "pdf" ? (
              <foreignObject 
                x="119.5" 
                y="95" 
                width="119.5" 
                height="105" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <iframe
                  src={`${imageUrls[3]}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    pointerEvents: 'none'
                  }}
                  title="PDF Preview"
                  onLoad={() => handleImageLoad(3)}
                  onError={() => handleImageLoad(3)}
                />
              </foreignObject>
            ) : assetTypes[3] === "image" ? (
              <foreignObject 
                x="119.5" 
                y="95" 
                width="119.5" 
                height="105" 
                mask={`url(#cardMask-${id})`}
                className={urlsResolved ? "animate-stagger-fade-in" : "opacity-0"}
                style={urlsResolved ? { animationDelay: '0ms' } : {}}
              >
                <img
                  src={imageUrls[3]}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    willChange: 'opacity',
                    contain: 'layout style paint',
                  }}
                  alt="Asset preview"
                  crossOrigin="anonymous"
                  onLoad={() => handleImageLoad(3)}
                />
              </foreignObject>
            ) : (
              <rect x="119.5" y="95" width="119.5" height="105" fill="#f3f4f6" />
            )}

            {/* Top gradient overlay */}
            <rect x="0" y="0" width="239" height="200" fill={`url(#topGradient-${id})`} />

            {/* Bottom gradient overlay */}
            <rect x="0" y="0" width="239" height="200" fill={`url(#bottomGradient-${id})`} />

            {/* Horizontal grid line (at y=95, midt i højden) */}
            <line
              x1="0"
              y1="95"
              x2="239"
              y2="95"
              stroke="#FFFDFD"
              strokeWidth="1.5"
              opacity="0.6"
            />

            {/* Vertical grid line (at x=119.5, midt i bredden) */}
            <line
              x1="119.5"
              y1="0"
              x2="119.5"
              y2="200"
              stroke="#FFFDFD"
              strokeWidth="1.5"
              opacity="0.6"
            />

          </g>

          {/* Video play icons removed for faster loading */}


          {/* HTML content inside SVG using foreignObject - automatically clipped by mask */}
          <foreignObject x="0" y="0" width="239" height="200" mask={`url(#cardMask-${id})`}>
            <div
              className="w-full h-full relative pointer-events-none"
              style={{
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
                width: '100%',
                height: '100%',
              }}
            >
              {/* Header section */}
              <div className="absolute" style={{ left: '5.02%', top: '8%' }}>
                <h2
                  className="text-white font-bold"
                  style={{
                    fontSize: 'clamp(13px, 2.88cqw, 15px)',
                    textShadow: '0px 2px 2px rgba(0, 0, 0, 0.10)',
                    lineHeight: '1',
                  }}
                >
                  {label}
                </h2>
                <p
                  className="text-white font-light"
                  style={{
                    fontSize: 'clamp(9px, 1.92cqw, 10px)',
                    textShadow: '0px 2px 2px rgba(0, 0, 0, 0.10)',
                    marginTop: '7px',
                    lineHeight: '1',
                  }}
                >
                  {assetCount} assets
                </p>
              </div>
            </div>
          </foreignObject>
        </svg>

        {/* Heart button - outside SVG for blur to work */}
        <button
          onClick={(e) => {
            e.preventDefault()
            setIsLiked(!isLiked)
          }}
          className="absolute pointer-events-auto rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10"
          style={{
            left: '77.82%',
            top: '5%',
            width: 'clamp(38px, 13cqw, 100px)',
            height: 'clamp(38px, 13cqw, 100px)',
            background: 'rgba(255, 255, 255, 0.30)',
            backdropFilter: 'blur(14.5px)',
            WebkitBackdropFilter: 'blur(14.5px)',
          }}
          aria-label="Like"
        >
          <Heart
            className={`transition-all ${isLiked ? "fill-white text-white scale-110" : "text-white"}`}
            style={{ width: 'clamp(16px, 5cqw, 48px)', height: 'clamp(16px, 5cqw, 46px)' }}
          />
        </button>

        {/* "Se hele kampagnen" button - outside SVG for blur to work */}
        {/* Justeret bottom så knappen holder sig inden for kortets kurve */}
        <div
          className="absolute pointer-events-auto z-10"
          style={{
            left: '5.02%',
            bottom: '8%',
            width: '65%',
            height: 'clamp(40px, 12cqw, 90px)',
            background: 'rgba(255, 255, 255, 0.30)',
            borderRadius: 'clamp(25px, 8cqw, 60px)',
            backdropFilter: 'blur(14.550000190734863px)',
            WebkitBackdropFilter: 'blur(14.550000190734863px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span
            className="text-white font-semibold text-center whitespace-nowrap"
            style={{
              fontSize: 'clamp(12px, 4cqw, 28px)',
              textShadow: '1px 1px 1px rgba(0, 0, 0, 0.25)',
            }}
          >
            View collection
          </span>
        </div>

        {/* Arrow button positioned outside - not clipped */}
        <button
          className="absolute rounded-full flex items-center justify-center hover:scale-105 transition-transform pointer-events-auto z-20"
          style={{
            bottom: 'clamp(2px, 0.66cqw, 8px)',
            right: 'clamp(2px, 0.66cqw, 8px)',
            width: 'clamp(42px, 18cqw, 135px)',
            height: 'clamp(42px, 18cqw, 135px)',
            backgroundColor: '#E5E5E5',
          }}
        >
          <svg
            viewBox="0 8 25 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid"
            style={{
              width: 'clamp(22px, 7.5cqw, 56px)',
              height: 'clamp(18px, 6cqw, 46px)',
            }}
          >
            <path
              d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
              stroke="black"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
    </Link>
  )
}

// Memoize component to prevent unnecessary re-renders
export const CollectionCard = memo(CollectionCardComponent, (prevProps, nextProps) => {
  // Only re-render if critical props change
  if (prevProps.id !== nextProps.id) return false
  if (prevProps.label !== nextProps.label) return false
  if (prevProps.assetCount !== nextProps.assetCount) return false
  
  // Compare preview assets by IDs
  const prevIds = prevProps.previewAssets.slice(0, 4).map(a => a.id).join(',')
  const nextIds = nextProps.previewAssets.slice(0, 4).map(a => a.id).join(',')
  if (prevIds !== nextIds) return false
  
  return true // Props are equal, skip re-render
})