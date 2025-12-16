"use client"

import { useState, useEffect } from "react"
import { Heart } from "lucide-react"
import Link from "next/link"

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
  const [imageUrls, setImageUrls] = useState<string[]>(["/placeholder.jpg", "/placeholder.jpg", "/placeholder.jpg", "/placeholder.jpg"])
  const [assetTypes, setAssetTypes] = useState<string[]>(["unknown", "unknown", "unknown", "unknown"])
  const [videoUrls, setVideoUrls] = useState<string[]>(["", "", "", ""])

  useEffect(() => {
    const fetchImageUrls = async () => {
      const urls: string[] = []
      const types: string[] = []
      const videoUrlsArr: string[] = []

      for (const asset of previewAssets.slice(0, 4)) {
        if (asset.storage_path) {
          // For video files, use thumbnail if available, otherwise use video itself
          if (asset.mime_type.startsWith("video/")) {
            types.push("video")
            // Always create video URL for video assets using proxy API
            const cleanVideoPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
            const videoUrl = `/api/assets/${encodeURIComponent(cleanVideoPath)}`
            videoUrlsArr.push(videoUrl)

            if (asset.thumbnail_path) {
              // Use thumbnail for image pattern if available
              const cleanThumbnailPath = asset.thumbnail_path.replace(/^\/+|\/+$/g, "")
              const thumbnailUrl = `/api/assets/${encodeURIComponent(cleanThumbnailPath)}`
              urls.push(thumbnailUrl)
            } else {
              // Use video URL as fallback for image pattern (won't work but at least consistent)
              urls.push(videoUrl)
            }
          } else if (asset.mime_type === "application/pdf") {
            types.push("pdf")
            videoUrlsArr.push("") // Empty for non-video assets
            // Create proxy URL for PDF
            const cleanPdfPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
            const pdfUrl = `/api/assets/${encodeURIComponent(cleanPdfPath)}`
            urls.push(pdfUrl)
          } else {
            types.push("image")
            videoUrlsArr.push("") // Empty for non-video assets
            // Clean path - remove leading/trailing slashes
            const cleanPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
            const imageUrl = `/api/assets/${encodeURIComponent(cleanPath)}`
            urls.push(imageUrl)
          }
        } else {
          urls.push("/placeholder.jpg")
          types.push("unknown")
          videoUrlsArr.push("")
        }
      }

      // Fill remaining slots with placeholder
      while (urls.length < 4) {
        urls.push("/placeholder.jpg")
        types.push("unknown")
        videoUrlsArr.push("")
      }

      setImageUrls(urls)
      setAssetTypes(types)
      setVideoUrls(videoUrlsArr)
    }

    if (previewAssets.length > 0) {
      fetchImageUrls()
    }
  }, [previewAssets])


  return (
    <Link href={`/assets/collections/${id}`}>
      <div className="relative w-full min-w-[200px] aspect-[239/200] overflow-hidden" style={{ containerType: 'inline-size' }}>
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

            {/* Dynamic image patterns */}
            <pattern id={`img1-${id}`} width="1" height="1" patternContentUnits="objectBoundingBox">
              <image
                href={imageUrls[0] || "/placeholder.jpg"}
                width="1"
                height="1"
                preserveAspectRatio="xMidYMid slice"
                crossOrigin="anonymous"
              />
            </pattern>

            <pattern id={`img2-${id}`} width="1" height="1" patternContentUnits="objectBoundingBox">
              <image
                href={imageUrls[1] || "/placeholder.jpg"}
                width="1"
                height="1"
                preserveAspectRatio="xMidYMid slice"
                crossOrigin="anonymous"
              />
            </pattern>

            <pattern id={`img3-${id}`} width="1" height="1" patternContentUnits="objectBoundingBox">
              <image
                href={imageUrls[2] || "/placeholder.jpg"}
                width="1"
                height="1"
                preserveAspectRatio="xMidYMid slice"
                crossOrigin="anonymous"
              />
            </pattern>

            <pattern id={`img4-${id}`} width="1" height="1" patternContentUnits="objectBoundingBox">
              <image
                href={imageUrls[3] || "/placeholder.jpg"}
                width="1"
                height="1"
                preserveAspectRatio="xMidYMid slice"
                crossOrigin="anonymous"
              />
            </pattern>

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
            {assetTypes[0] === "video" && videoUrls[0] ? (
              <foreignObject x="0" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
                <video
                  src={videoUrls[0]}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  preload="metadata"
                  muted
                  playsInline
                />
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
                />
              </foreignObject>
            ) : (
              <rect x="0" y="0" width="119.5" height="95" fill={`url(#img1-${id})`} />
            )}

            {assetTypes[1] === "video" && videoUrls[1] ? (
              <foreignObject x="119.5" y="0" width="119.5" height="95" mask={`url(#cardMask-${id})`}>
                <video
                  src={videoUrls[1]}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  preload="metadata"
                  muted
                  playsInline
                />
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
                />
              </foreignObject>
            ) : (
              <rect x="119.5" y="0" width="119.5" height="95" fill={`url(#img2-${id})`} />
            )}

            {assetTypes[2] === "video" && videoUrls[2] ? (
              <foreignObject x="0" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
                <video
                  src={videoUrls[2]}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  preload="metadata"
                  muted
                  playsInline
                />
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
                />
              </foreignObject>
            ) : (
              <rect x="0" y="95" width="119.5" height="105" fill={`url(#img3-${id})`} />
            )}

            {assetTypes[3] === "video" && videoUrls[3] ? (
              <foreignObject x="119.5" y="95" width="119.5" height="105" mask={`url(#cardMask-${id})`}>
                <video
                  src={videoUrls[3]}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  preload="metadata"
                  muted
                  playsInline
                />
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
                />
              </foreignObject>
            ) : (
              <rect x="119.5" y="95" width="119.5" height="105" fill={`url(#img4-${id})`} />
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
