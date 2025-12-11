"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Download, Heart, Link2, Share2, Sparkles, SlidersHorizontal } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

interface Asset {
  id: string
  client_id: string
  title: string
  description: string | null
  storage_bucket: string
  storage_path: string
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  uploaded_by: string | null
  created_at: string
  category_tag_id: string | null
}

interface User {
  full_name: string
}

interface Tag {
  id: string
  label: string
}

interface ActivityEvent {
  id: string
  event_type: string
  created_at: string
  user_id: string
  source?: string
  metadata?: Record<string, any>
}

interface AssetVersion {
  id: string
  version_label: string | null
  storage_path: string
  storage_bucket: string
  mime_type: string | null
  width: number | null
  height: number | null
  dpi: number | null
  file_size: number | null
  created_at: string
}

const presetOptions = [
  { id: "social", label: "Social story - 1080x1920", width: 1080, height: 1920, format: "jpeg" as const },
  { id: "web", label: "Web - 1600px", width: 1600, height: null, format: "jpeg" as const },
  { id: "print", label: "Print - 300 DPI TIFF", width: null, height: null, format: "tiff" as const, dpi: 300 },
]

const formatOptions = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "tiff", label: "TIFF" },
]

export default function AssetDetailPage() {
  const params = useParams()
  const id = params.id as string

  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const [asset, setAsset] = useState<Asset | null>(null)
  const [uploader, setUploader] = useState<User | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [favorite, setFavorite] = useState<any>(null)
  const [storageData, setStorageData] = useState<any>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloadingPreset, setIsDownloadingPreset] = useState(false)
  const [isDownloadingCustom, setIsDownloadingCustom] = useState(false)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [versions, setVersions] = useState<AssetVersion[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>("social")
  const [customFormat, setCustomFormat] = useState<string>("jpeg")
  const [customWidth, setCustomWidth] = useState<string>("")
  const [customHeight, setCustomHeight] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCopyingLink, setIsCopyingLink] = useState(false)
  const [downloadMode, setDownloadMode] = useState<"preset" | "custom">("preset")

  useEffect(() => {
    if (asset?.width) {
      setCustomWidth(String(asset.width))
    }
    if (asset?.height) {
      setCustomHeight(String(asset.height))
    }
  }, [asset?.width, asset?.height])

  useEffect(() => {
    if (!id || !isValidUUID(id)) {
      router.push("/assets")
      return
    }
    void loadAsset()
  }, [id, router])

  const loadAsset = async () => {
    const supabase = supabaseRef.current
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
      router.push("/login")
      return
    }

    const { data: assetData, error } = await supabase.from("assets").select("*").eq("id", id).single()

    if (!assetData || error) {
      router.push("/assets")
      return
    }

    setAsset(assetData)

    const { data: uploaderData } = await supabase.from("users").select("full_name").eq("id", assetData.uploaded_by).single()
    setUploader(uploaderData)

    const { data: favoriteData } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("asset_id", id)
    .maybeSingle()
    setFavorite(favoriteData)
    setIsFavorited(!!favoriteData)

  const { data: assetTags } = await supabase.from("asset_tags").select("tags(*)").eq("asset_id", id)
    setTags(assetTags?.map((at: any) => at.tags) || [])

    // Ensure storage_path doesn't have leading/trailing slashes
    const cleanPath = assetData.storage_path.replace(/^\/+|\/+$/g, "")
    
    console.log("Creating signed URL for:", {
      bucket: assetData.storage_bucket,
      path: cleanPath,
      originalPath: assetData.storage_path,
      mimeType: assetData.mime_type
    })

    const { data: storageUrl, error: storageError } = await supabase.storage
      .from(assetData.storage_bucket)
      .createSignedUrl(cleanPath, 3600)

    if (storageError) {
      console.error("Storage URL error:", storageError)
      console.error("Failed path:", cleanPath)
      setErrorMessage(`Failed to generate access URL: ${storageError.message}`)
      return
    }

    console.log("Generated signed URL for", assetData.mime_type, ":", storageUrl?.signedUrl)
    setStorageData(storageUrl)

    await Promise.all([loadActivity(), loadVersions()])

    setIsLoading(false)
  }

  const loadActivity = async () => {
      const supabase = supabaseRef.current
    const { data } = await supabase
      .from("asset_events")
      .select("*")
      .eq("asset_id", id)
      .order("created_at", { ascending: false })
      .limit(20)

    setActivity(data || [])
  }

  const loadVersions = async () => {
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from("asset_versions")
      .select(
        "id, version_label, storage_path, storage_bucket, mime_type, width, height, dpi, file_size, created_at",
      )
      .eq("asset_id", id)
      .order("created_at", { ascending: false })

    setVersions(data || [])
  }

  const handleFavorite = async () => {
    if (!asset) return

    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    try {
      if (isFavorited) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("asset_id", asset.id)
        setIsFavorited(false)
        setFavorite(null)
      } else {
        const { data: newFavorite } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            asset_id: asset.id,
          })
          .select("id")
          .single()
        setIsFavorited(true)
        setFavorite(newFavorite)
      }
    } catch (error) {
      console.error("Favorite toggle failed:", error)
      setErrorMessage("Kunne ikke opdatere favorit.")
    }
  }

  const logAssetEvent = async (eventType: string, metadata?: Record<string, any>) => {
    if (!asset) return
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("asset_events").insert({
      asset_id: asset.id,
      client_id: asset.client_id,
      user_id: user.id,
      event_type: eventType,
      source: "web",
      metadata,
    })
    await loadActivity()
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const downloadOriginal = async (metadata?: Record<string, any>) => {
    if (!asset || !storageData?.signedUrl) return
    const res = await fetch(storageData.signedUrl)
    const blob = await res.blob()
    downloadBlob(blob, asset.title || "asset")
    await logAssetEvent("download", { ...metadata, kind: "original" })
  }

  const transformAndDownload = async ({
    targetWidth,
    targetHeight,
    format,
    label,
    source,
  }: {
    targetWidth: number | null
    targetHeight: number | null
    format: "jpeg" | "png" | "tiff"
    label: string
    source: "preset" | "custom"
  }) => {
    if (!asset || !storageData?.signedUrl) return
    setErrorMessage(null)

    if (!asset.mime_type.startsWith("image/")) {
      await downloadOriginal({ label, source, fallback: "non-image" })
      return
    }

    if (format === "tiff") {
      console.warn("TIFF transform not supported client-side. Falling back to original.")
      await downloadOriginal({ label, source, fallback: "tiff-original" })
      return
    }

    try {
      const res = await fetch(storageData.signedUrl)
      const blob = await res.blob()
      const img = await loadImageFromBlob(blob)

      const width = targetWidth || img.width
      const height = targetHeight || Math.round((img.height / img.width) * width)

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context missing")
      ctx.drawImage(img, 0, 0, width, height)

      const mime = format === "png" ? "image/png" : "image/jpeg"
      const dataUrl = canvas.toDataURL(mime, 0.92)
      const transformedBlob = dataURLToBlob(dataUrl)
      const filename = `${asset.title || "asset"}-${label.replace(/\s+/g, "-").toLowerCase()}.${format}`

      downloadBlob(transformedBlob, filename)
      await logAssetEvent("download", { label, source, format, width, height })
    } catch (error) {
      console.error("Transform download failed", error)
      setErrorMessage("Kunne ikke downloade. Viser original.")
      await downloadOriginal({ label, source, fallback: "transform-failed" })
    }
  }

  const handlePresetDownload = async () => {
    const preset = presetOptions.find((p) => p.id === selectedPresetId)
    if (!preset) return
    setIsDownloadingPreset(true)
    await transformAndDownload({
      targetWidth: preset.width,
      targetHeight: preset.height,
      format: preset.format,
      label: preset.label,
      source: "preset",
    })
    setIsDownloadingPreset(false)
  }

  const handleCustomDownload = async () => {
    if (!customWidth || !customHeight) {
      setErrorMessage("Angiv både bredde og højde for custom export.")
      return
    }
    const width = Number(customWidth)
    const height = Number(customHeight)
    if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
      setErrorMessage("Bredde og højde skal være gyldige tal større end 0.")
      return
    }
    setIsDownloadingCustom(true)
    await transformAndDownload({
      targetWidth: width,
      targetHeight: height,
      format: customFormat as "jpeg" | "png" | "tiff",
      label: `Custom ${width}x${height}`,
      source: "custom",
    })
    setIsDownloadingCustom(false)
  }

  const handleShare = async () => {
    if (!asset) return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: asset.title, url })
        await logAssetEvent("share", { label: "share", source: "share" })
      } catch (error) {
        console.error("Share failed", error)
      }
    } else {
      await handleCopyLink()
    }
  }

  const handleCopyLink = async () => {
    if (!asset) return
    const url = window.location.href
    setIsCopyingLink(true)
    try {
      await navigator.clipboard.writeText(url)
    } catch (error) {
      console.error("Copy failed", error)
      setErrorMessage("Kunne ikke kopiere link.")
    } finally {
      setIsCopyingLink(false)
    }
  }

  const previewUrl = useMemo(() => {
    return storageData?.signedUrl || null
  }, [storageData?.signedUrl])

  const isImage = asset?.mime_type?.startsWith("image/")
  const isVideo = asset?.mime_type?.startsWith("video/")

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f6]">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#dc3545] border-t-transparent" />
          <p className="text-sm text-gray-600">Loading asset…</p>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f6]">
        <div className="rounded-xl bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-gray-700">Asset not found</p>
          <Link href="/assets">
            <Button className="mt-4">Back to Assets</Button>
          </Link>
        </div>
      </div>
    )
  }

  const handlePresetChange = (val: string) => {
    setSelectedPresetId(val)
    const preset = presetOptions.find((p) => p.id === val)
    if (preset?.width) setCustomWidth(String(preset.width))
    if (preset?.height) setCustomHeight(String(preset.height))
  }

  return (
    <div className="flex min-h-screen bg-[#f5f5f6] text-gray-900">
      {/* Main wrapper keeps content separate from sidebar */}
      <div className="relative flex min-h-screen flex-1">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col px-6 pb-32 pt-6">
          {/* Header */}
          <div className="flex w-full items-center justify-between text-sm text-gray-500 mb-8">
            <div className="flex items-center gap-3">
              <Link
                href="/assets"
                className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
              <span className="truncate text-sm text-gray-500">{asset.title}</span>
            </div>
            <button
              aria-label="Toggle favorite"
              onClick={handleFavorite}
              className={`flex h-10 w-10 items-center justify-center rounded-full border ${isFavorited ? "border-rose-200 bg-rose-50 text-rose-500" : "border-gray-200 bg-white text-gray-500"} shadow-sm transition hover:border-rose-200 hover:text-rose-200`}
            >
              <Heart className={`h-5 w-5 ${isFavorited ? "fill-rose-500" : ""}`} />
            </button>
          </div>

          {/* Asset Preview - Centered */}
          <div className="flex flex-1 items-center justify-center min-h-0">
            <div className="w-full flex items-center justify-center">
              {previewUrl ? (
                <>
                  {isImage && (
                    <img src={previewUrl} alt={asset.title} className="max-h-[72vh] max-w-full object-contain" />
                  )}
                  {isVideo && (
                    <video
                      src={previewUrl || undefined}
                      controls
                      className="max-h-[72vh] max-w-full object-contain rounded-2xl"
                      preload="metadata"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error("Video load error:", e);
                        console.error("Video URL:", previewUrl);
                        console.error("Asset storage path:", asset?.storage_path);
                        setErrorMessage("Failed to load video. The file may not exist or be corrupted. Check console for details.");
                      }}
                      onLoadStart={() => {
                        console.log("Video loading started:", previewUrl);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </>
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500">
                  Preview not available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation bar - positioned above download toolbar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center">
          <div className="pointer-events-auto px-6">
            <div className="inline-flex items-center justify-center gap-4 rounded-full border border-gray-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-gray-300">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[64px] text-center text-sm font-medium text-gray-800">1 / 93</span>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-gray-300">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Download/Transform bar - positioned at bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <div className="pointer-events-auto w-full max-w-5xl px-6">
            <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 rounded-[18px] border border-gray-200 bg-white/96 px-4 py-3 shadow-lg backdrop-blur sm:px-5 sm:py-3 md:px-6">
              <div className="flex items-center gap-2 text-gray-700 shrink-0">
                <span className="hidden text-sm font-semibold sm:inline">
                  {downloadMode === "preset" ? "Download preset" : "Download custom"}
                </span>
                <Download className="h-4 w-4 text-gray-500" />
              </div>

          <div className="flex h-10 flex-shrink-0 items-center rounded-full bg-gray-300/70 px-1 shadow-inner">
            <button
              onClick={() => setDownloadMode("preset")}
                  className={`flex h-8 w-14 sm:w-28 items-center justify-center rounded-full text-sm font-semibold transition ${downloadMode === "preset" ? "bg-[#e65872] text-white shadow-sm" : "text-gray-700"}`}
            >
                  <span className="hidden sm:inline">Preset</span>
                  <Sparkles className="h-4 w-4 sm:hidden" />
            </button>
            <button
              onClick={() => setDownloadMode("custom")}
                  className={`flex h-8 w-14 sm:w-28 items-center justify-center rounded-full text-sm font-semibold transition ${downloadMode === "custom" ? "bg-[#e65872] text-white shadow-sm" : "text-gray-700"}`}
            >
                  <span className="hidden sm:inline">Custom</span>
                  <SlidersHorizontal className="h-4 w-4 sm:hidden" />
            </button>
          </div>

              {downloadMode === "preset" ? (
                <>
                  <Select value={selectedPresetId} onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-10 w-32 sm:w-64 rounded-full border border-gray-200 bg-white text-xs sm:text-sm shadow-lg shadow-gray-200/70 transition hover:border-gray-300">
                      <SelectValue placeholder="Preset" className="text-left" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[220px] rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur">
                      {presetOptions.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Select value={customFormat} onValueChange={setCustomFormat}>
                    <SelectTrigger className="h-10 w-20 sm:w-28 rounded-full border border-gray-200 bg-white text-xs sm:text-sm shadow-lg shadow-gray-200/70 transition hover:border-gray-300">
                      <SelectValue placeholder="Fmt" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur">
                      {formatOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex h-10 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs sm:text-sm shadow-sm shrink-0">
                    <span className="text-gray-600">W</span>
                    <Input
                      type="number"
                      min={1}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="px"
                      className="h-8 w-14 sm:w-16 border-none bg-transparent p-0 text-right text-xs sm:text-sm focus-visible:ring-0 appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex h-10 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs sm:text-sm shadow-sm shrink-0">
                    <span className="text-gray-600">H</span>
                    <Input
                      type="number"
                      min={1}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      placeholder="px"
                      className="h-8 w-14 sm:w-16 border-none bg-transparent p-0 text-right text-xs sm:text-sm focus-visible:ring-0 appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </>
              )}

          <div className="flex flex-1" />

              <Button
                size="sm"
                className="ml-auto h-10 shrink-0 rounded-full bg-[#e65872] px-4 sm:px-6 text-white hover:bg-[#d74f68]"
                onClick={downloadMode === "preset" ? handlePresetDownload : handleCustomDownload}
                disabled={downloadMode === "preset" ? isDownloadingPreset : isDownloadingCustom}
              >
                <Download className="mr-0 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {downloadMode === "preset"
                    ? isDownloadingPreset
                      ? "Downloading…"
                      : "Download"
                    : isDownloadingCustom
                      ? "Downloading…"
                      : "Download"}
                </span>
              </Button>
          </div>
        </div>
      </div>
      </div>

      {/* Sidebar (drawer) kept isolated on the right */}
      <aside className="sticky top-0 h-screen w-[360px] shrink-0 bg-[#f5f5f6]">
        <div className="flex h-full min-h-0 flex-col p-6">
          <div className="flex h-full min-h-0 flex-col rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-base font-semibold text-gray-900">{asset.title}</h1>
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 3).map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {errorMessage}
                </div>
              )}

              <Accordion type="multiple" defaultValue={["file-info", "download-options"]} className="space-y-2">
                <AccordionItem value="file-info">
                  <AccordionTrigger className="text-sm font-semibold text-gray-800">File info</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
                      <InfoRow label="File type" value={asset.mime_type} />
                      <InfoRow label="File size" value={`${(asset.file_size / 1024 / 1024).toFixed(2)} MB`} />
                      {asset.width && asset.height && <InfoRow label="Dimensions" value={`${asset.width} × ${asset.height}`} />}
                      <InfoRow label="Uploaded by" value={uploader?.full_name || "-"} />
                      <InfoRow
                        label="Uploaded"
                        value={new Date(asset.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tags">
                  <AccordionTrigger className="text-sm font-semibold text-gray-800">Tags</AccordionTrigger>
                  <AccordionContent>
                    {tags.length ? (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                            {tag.label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Ingen tags tilknyttet.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="versions">
                  <AccordionTrigger className="text-sm font-semibold text-gray-800">Versions</AccordionTrigger>
                  <AccordionContent>
                    {versions.length === 0 ? (
                      <p className="text-sm text-gray-500">Ingen versions endnu.</p>
                    ) : (
                      <div className="space-y-3">
                        {versions.map((version) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm"
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900">{version.version_label || "Version"}</div>
                              <div className="text-xs text-gray-500">
                                {version.width && version.height ? `${version.width}x${version.height}` : "Original size"}
                                {version.mime_type ? ` · ${version.mime_type}` : ""}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(version.created_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activity">
                  <AccordionTrigger className="text-sm font-semibold text-gray-800">Activity</AccordionTrigger>
                  <AccordionContent>
                    {activity.length === 0 ? (
                      <p className="text-sm text-gray-500">Ingen aktivitet endnu.</p>
                    ) : (
                      <div className="space-y-3">
                        {activity.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-gray-400" />
                              <div className="text-sm text-gray-800 capitalize">{event.event_type}</div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(event.created_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Actions pinned to bottom of sidebar */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleCopyLink} disabled={isCopyingLink}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  )
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl)
      reject(err)
    }
    img.src = objectUrl
  })
}

function dataURLToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",")
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png"
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}
