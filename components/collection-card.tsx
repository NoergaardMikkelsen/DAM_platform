"use client"

import { useState, useEffect, useRef } from "react"
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
    thumbnail_path?: string | null
  }>
  onLoaded?: () => void // Callback when card is fully loaded
}

export function CollectionCard({ id, label, assetCount, previewAssets, onLoaded }: CollectionCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>(["", "", "", ""])
  const [assetTypes, setAssetTypes] = useState<string[]>(["placeholder", "placeholder", "placeholder", "placeholder"])
  const [videoUrls, setVideoUrls] = useState<string[]>(["", "", "", ""])
  const [loadedImages, setLoadedImages] = useState<boolean[]>([false, false, false, false])
  const [urlsResolved, setUrlsResolved] = useState(false) // Track if URLs have been resolved
  const hasNotifiedLoaded = useRef(false) // Track if we've already notified parent

  // Calculate how many assets we actually have (non-placeholder)
  const actualAssetCount = assetTypes.filter(type => type !== "placeholder").length
  
  // Check if card is ready to show - URLs must be resolved, media can load in background
  // This ensures all cards appear simultaneously, regardless of video/image loading speed
  const allAssetsLoaded = urlsResolved

  // Notify parent when card is fully loaded (only once)
  useEffect(() => {
    if (allAssetsLoaded && onLoaded && !hasNotifiedLoaded.current) {
      console.log(`[CollectionCard] "${label}": Card fully loaded, notifying parent`)
      hasNotifiedLoaded.current = true
      onLoaded()
    }
  }, [allAssetsLoaded, onLoaded, label])

  const handleImageLoad = (index: number) => {
    console.log(`[CollectionCard] "${label}": Asset ${index} loaded (type: ${assetTypes[index]})`)
    // Track loaded state for potential future use (currently not blocking card visibility)
    setLoadedImages(prev => {
      const newLoaded = [...prev]
      newLoaded[index] = true
      return newLoaded
    })
  }

  // Timeout fallbacks removed - cards show as soon as URLs are resolved
  // Media can load in background while card is already visible

  useEffect(() => {
    // Reset states when previewAssets change
    setUrlsResolved(false)
    setLoadedImages([false, false, false, false])
    setImageUrls(["", "", "", ""])
    setAssetTypes(["placeholder", "placeholder", "placeholder", "placeholder"])
    setVideoUrls(["", "", "", ""])
    hasNotifiedLoaded.current = false // Reset notification flag
    
    const fetchImageUrls = async () => {
      const loader = BatchAssetLoader.getInstance()
      const assetData: Array<{
        type: string
        storagePath: string
        thumbnailPath?: string
        isVideo: boolean
        isPdf: boolean
      }> = []

      const videoCount = previewAssets.filter((a: any) => a.mime_type?.startsWith("video/")).length
      console.log(`[CollectionCard] "${label}": Received ${previewAssets.length} preview assets (${videoCount} videos)`)

      // Collect all paths that need URLs
      for (const asset of previewAssets.slice(0, 4)) {
        if (asset.storage_path) {
          const cleanPath = asset.storage_path.replace(/^\/+|\/+$/g, "")

          if (asset.mime_type.startsWith("video/")) {
            const thumbnailPath = asset.thumbnail_path?.replace(/^\/+|\/+$/g, "")
            console.log(`[CollectionCard] "${label}": Processing video asset: ${asset.id}`)
            console.log(`[CollectionCard] "${label}":   - Storage path: ${cleanPath}`)
            console.log(`[CollectionCard] "${label}":   - Thumbnail path: ${thumbnailPath || 'none'}`)
            assetData.push({
              type: "video",
              storagePath: cleanPath,
              thumbnailPath: thumbnailPath,
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

          if (data.isVideo) {
            // Get video URL for video playback with error handling
            console.log(`[CollectionCard] "${label}": Creating video promise for: ${data.storagePath}`)
            const videoPromise = loader.getSignedUrl(data.storagePath)
              .then((url) => {
                console.log(`[CollectionCard] "${label}": Video URL resolved: ${url.substring(0, 50)}...`)
                return url
              })
              .catch((error) => {
                console.error(`[CollectionCard] "${label}": Error getting video URL for ${data.storagePath}:`, error)
                return ""
              })
            videoUrlPromises.push(videoPromise)

            // Get thumbnail URL for display, fallback to video URL
            if (data.thumbnailPath) {
              const thumbnailPath = data.thumbnailPath // Store in local variable for TypeScript
              console.log(`[CollectionCard] "${label}": Requesting thumbnail URL for path: ${thumbnailPath}`)
              // Create a promise that always resolves - either with thumbnail URL or video URL fallback
              // Use Promise.race to ensure it resolves within 1 second or falls back to video immediately
              const thumbnailPromise = (async () => {
                try {
                  // Try to get thumbnail URL with 1 second timeout (much faster fallback)
                  const thumbnailUrl = await Promise.race([
                    loader.getSignedUrl(thumbnailPath),
                    new Promise<string>((_, reject) => 
                      setTimeout(() => reject(new Error("Thumbnail URL timeout")), 1000)
                    )
                  ])
                  console.log(`[CollectionCard] "${label}": Thumbnail URL resolved: ${thumbnailUrl.substring(0, 50)}...`)
                  return thumbnailUrl
                } catch (error) {
                  // Fallback to video URL immediately - don't log warning as this is expected behavior
                  try {
                    const fallbackUrl = await videoPromise
                    return fallbackUrl
                  } catch (videoError) {
                    console.error(`[CollectionCard] "${label}": Error getting fallback video URL:`, videoError)
                    return ""
                  }
                }
              })()
              urlPromises.push(thumbnailPromise)
            } else {
              console.log(`[CollectionCard] "${label}": No thumbnail path, will use video URL as fallback`)
              urlPromises.push(videoPromise)
            }
          } else {
            videoUrlPromises.push(Promise.resolve(""))
            urlPromises.push(
              loader.getSignedUrl(data.storagePath).catch((error) => {
                console.error(`[CollectionCard] "${label}": Error getting URL for ${data.storagePath}:`, error)
                return ""
              })
            )
          }
        }
      }

      // Wait for all URLs to resolve with error handling and timeout
      try {
        console.log(`[CollectionCard] "${label}": Waiting for ${urlPromises.length} URL promises to resolve...`)
        console.log(`[CollectionCard] "${label}": URL promises: ${urlPromises.length}, Video promises: ${videoUrlPromises.length}`)
        
        // Create a timeout promise that rejects after 3 seconds (thumbnails have 1s timeout, so 3s is safe)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Timeout: URL resolution took longer than 3 seconds for collection "${label}"`))
          }, 3000)
        })

        const [urls, videoUrls] = await Promise.race([
          Promise.all([
            Promise.all(urlPromises),
            Promise.all(videoUrlPromises)
          ]),
          timeoutPromise
        ]) as [string[], string[]]

        console.log(`[CollectionCard] "${label}": URLs resolved. Types: [${types.join(", ")}]`)
        console.log(`[CollectionCard] "${label}": Video URLs:`, videoUrls.filter((url: string) => url !== ""))
        console.log(`[CollectionCard] "${label}": Image/Thumbnail URLs:`, urls.filter((url: string) => url !== ""))
        
        // Log detailed info for each video
        types.forEach((type, index) => {
          if (type === "video") {
            console.log(`[CollectionCard] "${label}": Video slot ${index}:`)
            console.log(`[CollectionCard] "${label}":   - Has thumbnail URL: ${!!urls[index] && urls[index] !== ""}`)
            console.log(`[CollectionCard] "${label}":   - Has video URL: ${!!videoUrls[index] && videoUrls[index] !== ""}`)
            if (urls[index]) {
              console.log(`[CollectionCard] "${label}":   - Thumbnail URL: ${urls[index].substring(0, 50)}...`)
            }
            if (videoUrls[index]) {
              console.log(`[CollectionCard] "${label}":   - Video URL: ${videoUrls[index].substring(0, 50)}...`)
            }
          }
        })

        setImageUrls(urls)
        setAssetTypes(types)
        setVideoUrls(videoUrls)
        setUrlsResolved(true) // Mark URLs as resolved
        // Reset loadedImages when URLs change
        setLoadedImages([false, false, false, false])
      } catch (error) {
        console.error(`[CollectionCard] "${label}": Error resolving URLs:`, error)
        // Set empty URLs on error to prevent infinite loading
        setImageUrls(["", "", "", ""])
        setAssetTypes(types)
        setVideoUrls(["", "", "", ""])
        setUrlsResolved(true) // Still mark as resolved so card can show (even if empty)
        setLoadedImages([false, false, false, false])
      }
    }

    if (previewAssets.length > 0) {
      fetchImageUrls().catch((error) => {
        console.error(`[CollectionCard] "${label}": Error in fetchImageUrls:`, error)
      })
    }
  }, [previewAssets])

  return (
    <Link href={`/assets/collections/${id}`}>
      <div 
        className="relative w-full aspect-[239/200] overflow-hidden transition-opacity duration-300 ease-out" 
        style={{ 
          containerType: 'inline-size',
          opacity: allAssetsLoaded ? 1 : 0
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
              <foreignObject x="0" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
                {/* For videos, show thumbnail if available and different from video URL, otherwise show video */}
                {imageUrls[0] && imageUrls[0] !== videoUrls[0] && !imageUrls[0].includes('.mp4') ? (
                  <img
                    src={imageUrls[0]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      console.log(`[CollectionCard] "${label}": Thumbnail 0 loaded successfully`)
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
                      console.log(`[CollectionCard] "${label}": Video 0 onLoadedData fired`)
                      handleImageLoad(0)
                    }}
                    onCanPlay={() => {
                      console.log(`[CollectionCard] "${label}": Video 0 onCanPlay fired`)
                      handleImageLoad(0)
                    }}
                    onLoadedMetadata={() => {
                      console.log(`[CollectionCard] "${label}": Video 0 onLoadedMetadata fired`)
                      handleImageLoad(0)
                    }}
                    onError={(e) => {
                      console.error(`[CollectionCard] "${label}": Video 0 error:`, e, `URL: ${videoUrls[0]}`)
                      handleImageLoad(0)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[0] === "pdf" ? (
              <foreignObject x="0" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
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
              <foreignObject x="0" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
                <img
                  src={imageUrls[0]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none'
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
              <foreignObject x="119.5" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
                {imageUrls[1] && imageUrls[1] !== videoUrls[1] && !imageUrls[1].includes('.mp4') ? (
                  <img
                    src={imageUrls[1]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      console.log(`[CollectionCard] "${label}": Thumbnail 1 loaded successfully`)
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
                      pointerEvents: 'none'
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      console.log(`[CollectionCard] "${label}": Video 1 onLoadedData fired`)
                      handleImageLoad(1)
                    }}
                    onCanPlay={() => {
                      console.log(`[CollectionCard] "${label}": Video 1 onCanPlay fired`)
                      handleImageLoad(1)
                    }}
                    onLoadedMetadata={() => {
                      console.log(`[CollectionCard] "${label}": Video 1 onLoadedMetadata fired`)
                      handleImageLoad(1)
                    }}
                    onError={(e) => {
                      console.error(`[CollectionCard] "${label}": Video 1 error:`, e, `URL: ${videoUrls[1]}`)
                      handleImageLoad(1)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[1] === "pdf" ? (
              <foreignObject x="119.5" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
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
              <foreignObject x="119.5" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
                <img
                  src={imageUrls[1]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none'
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
              <foreignObject x="0" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
                {imageUrls[2] && imageUrls[2] !== videoUrls[2] && !imageUrls[2].includes('.mp4') ? (
                  <img
                    src={imageUrls[2]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      console.log(`[CollectionCard] "${label}": Thumbnail 2 loaded successfully`)
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
                      pointerEvents: 'none'
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      console.log(`[CollectionCard] "${label}": Video 2 onLoadedData fired`)
                      handleImageLoad(2)
                    }}
                    onCanPlay={() => {
                      console.log(`[CollectionCard] "${label}": Video 2 onCanPlay fired`)
                      handleImageLoad(2)
                    }}
                    onLoadedMetadata={() => {
                      console.log(`[CollectionCard] "${label}": Video 2 onLoadedMetadata fired`)
                      handleImageLoad(2)
                    }}
                    onError={(e) => {
                      console.error(`[CollectionCard] "${label}": Video 2 error:`, e, `URL: ${videoUrls[2]}`)
                      handleImageLoad(2)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[2] === "pdf" ? (
              <foreignObject x="0" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
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
              <foreignObject x="0" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
                <img
                  src={imageUrls[2]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none'
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
              <foreignObject x="119.5" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
                {imageUrls[3] && imageUrls[3] !== videoUrls[3] && !imageUrls[3].includes('.mp4') ? (
                  <img
                    src={imageUrls[3]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    alt="Video thumbnail"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      console.log(`[CollectionCard] "${label}": Thumbnail 3 loaded successfully`)
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
                      pointerEvents: 'none'
                    }}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={() => {
                      console.log(`[CollectionCard] "${label}": Video 3 onLoadedData fired`)
                      handleImageLoad(3)
                    }}
                    onCanPlay={() => {
                      console.log(`[CollectionCard] "${label}": Video 3 onCanPlay fired`)
                      handleImageLoad(3)
                    }}
                    onLoadedMetadata={() => {
                      console.log(`[CollectionCard] "${label}": Video 3 onLoadedMetadata fired`)
                      handleImageLoad(3)
                    }}
                    onError={(e) => {
                      console.error(`[CollectionCard] "${label}": Video 3 error:`, e, `URL: ${videoUrls[3]}`)
                      handleImageLoad(3)
                    }}
                  />
                ) : null}
              </foreignObject>
            ) : assetTypes[3] === "pdf" ? (
              <foreignObject x="119.5" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
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
              <foreignObject x="119.5" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
                <img
                  src={imageUrls[3]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none'
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

          {/* Video play icons - outside mask */}
          {assetTypes[0] === "video" && (
            <g>
              <circle cx="59.75" cy="47.5" r="15" fill="rgba(0,0,0,0.8)" />
              <polygon points="56.75,43.5 56.75,51.5 62.75,47.5" fill="white" />
            </g>
          )}
          {assetTypes[1] === "video" && (
            <g>
              <circle cx="179.25" cy="47.5" r="15" fill="rgba(0,0,0,0.8)" />
              <polygon points="176.25,43.5 176.25,51.5 182.25,47.5" fill="white" />
            </g>
          )}
          {assetTypes[2] === "video" && (
            <g>
              <circle cx="59.75" cy="142.5" r="15" fill="rgba(0,0,0,0.8)" />
              <polygon points="56.75,138.5 56.75,146.5 62.75,142.5" fill="white" />
            </g>
          )}
          {assetTypes[3] === "video" && (
            <g>
              <circle cx="179.25" cy="142.5" r="15" fill="rgba(0,0,0,0.8)" />
              <polygon points="176.25,138.5 176.25,146.5 182.25,142.5" fill="white" />
            </g>
          )}


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
            Se hele kampagnen
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