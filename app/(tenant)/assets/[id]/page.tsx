"use client"

// #region agent log - hypothesis A: Test if imports work at runtime
try {
  fetch('http://127.0.0.1:7242/ingest/624209aa-5708-4f59-be04-d36ef34603e9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-typescript-errors',
      runId: 'initial-test',
      hypothesisId: 'A',
      location: 'app/(tenant)/assets/[id]/page.tsx:3',
      message: 'Testing if imports load successfully',
      data: { importAttempt: true },
      timestamp: Date.now()
    })
  }).catch(() => {});
} catch (e) {
  // Silent fail for debugging
}
// #endregion

import React, { useEffect, useMemo, useRef, useState, useTransition, use } from "react"
import type { ChangeEvent } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Heart,
  Link2,
  Share2,
  Sparkles,
  History,
  Wand2,
  Upload,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { uploadAsset, getImageDimensions, getVideoDimensions } from "@/lib/utils/storage"

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
  current_version_id?: string | null
  previous_version_id?: string | null
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

const videoPresetOptions = [
  { id: "hd", label: "HD Quality (1080p)", width: 1920, height: 1080, quality: "high" },
  { id: "sd", label: "SD Quality (720p)", width: 1280, height: 720, quality: "medium" },
  { id: "mobile", label: "Mobile Quality (480p)", width: 854, height: 480, quality: "low" },
  { id: "original", label: "Original Quality", quality: "original" },
]

const videoFormatOptions = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WebM (VP9)" },
  { value: "original", label: "Original Format" },
]

const formatOptions = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "tiff", label: "TIFF" },
]

export default function AssetDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string

  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const [isNavigating, startNavigation] = useTransition()

  // Memoize search params values to avoid unnecessary re-renders
  const searchContext = useMemo(() =>
    searchParams.get("context") || "all", [searchParams]
  )
  const searchCollectionId = useMemo(() =>
    searchParams.get("collectionId") || null, [searchParams]
  )

  const [asset, setAsset] = useState<Asset | null>(null)
  const [uploader, setUploader] = useState<User | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [favorite, setFavorite] = useState<any>(null)
  const [storageData, setStorageData] = useState<any>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloadingPreset, setIsDownloadingPreset] = useState(false)
  const [isDownloadingCustom, setIsDownloadingCustom] = useState(false)
  const [isDownloadingVideoCustom, setIsDownloadingVideoCustom] = useState(false)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [versions, setVersions] = useState<AssetVersion[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>("social")
  const [customFormat, setCustomFormat] = useState<string>("jpeg")
  const [customWidth, setCustomWidth] = useState<string>("")
  const [customHeight, setCustomHeight] = useState<string>("")
  const [videoFormat, setVideoFormat] = useState<string>("mp4")
  const [videoWidth, setVideoWidth] = useState<string>("")
  const [videoHeight, setVideoHeight] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCopyingLink, setIsCopyingLink] = useState(false)
  const [downloadMode, setDownloadMode] = useState<"preset" | "custom">("preset")
  const [navAssets, setNavAssets] = useState<Asset[]>([])
  const [navIndex, setNavIndex] = useState<number>(-1)
  const [videoErrorCount, setVideoErrorCount] = useState(0)
  const [isReplacing, setIsReplacing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previousVersion, setPreviousVersion] = useState<any | null>(null)
  const [previousPreviewUrl, setPreviousPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (asset?.width) {
      setCustomWidth(String(asset.width))
      setVideoWidth(String(asset.width))
    }
    if (asset?.height) {
      setCustomHeight(String(asset.height))
      setVideoHeight(String(asset.height))
    }
  }, [asset?.width, asset?.height])

  useEffect(() => {
    if (!id || !isValidUUID(id)) {
      router.push("/assets")
      return
    }
    void loadAsset(id, false)
  }, [id, router])

  const loadAsset = async (targetId: string, soft: boolean) => {
    // clear previous signed URL to avoid stale previews during navigation
    setStorageData(null)
    setVideoErrorCount(0)
    if (!soft) {
      setIsLoading(true)
    }

    const supabase = supabaseRef.current
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
      router.push("/login")
      return
    }

    const { data: assetData, error } = await supabase.from("assets").select("*").eq("id", targetId).single()

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
      .eq("asset_id", targetId)
    .maybeSingle()
    setFavorite(favoriteData)
    setIsFavorited(!!favoriteData)

    const { data: assetTags } = await supabase.from("asset_tags").select("tags(*)").eq("asset_id", targetId)
    setTags(assetTags?.map((at: any) => at.tags) || [])

    // Ensure storage_path doesn't have leading/trailing slashes
    const cleanPath = assetData.storage_path.replace(/^\/+|\/+$/g, "")
    
    console.log("Creating signed URL for:", {
      bucket: assetData.storage_bucket,
      path: cleanPath,
      originalPath: assetData.storage_path,
      mimeType: assetData.mime_type
    })

    // Use proxy endpoint instead of direct signed URL
    const storageUrl = { signedUrl: `/api/assets/${encodeURIComponent(cleanPath)}` }

    console.log("Generated signed URL for", assetData.mime_type, ":", storageUrl?.signedUrl)
    setStorageData(storageUrl)
    setVideoErrorCount(0)

    // Load previous version preview (if any)
    setPreviousVersion(null)
    setPreviousPreviewUrl(null)
    if (assetData.previous_version_id) {
      const { data: prevVersion } = await supabase
        .from("asset_versions")
        .select("id, storage_bucket, storage_path, mime_type, version_label, created_at, file_size")
        .eq("id", assetData.previous_version_id)
        .single()

      if (prevVersion) {
        setPreviousVersion(prevVersion)
        const prevClean = prevVersion.storage_path.replace(/^\/+|\/+$/g, "")
        // Use proxy endpoint instead of direct signed URL
        setPreviousPreviewUrl(`/api/assets/${encodeURIComponent(prevClean)}`)
      }
    }

    await Promise.all([loadActivity(assetData.id), loadVersions(assetData.id)])

    // Load navigation assets based on context
    const context = searchParams.get("context") || (assetData.category_tag_id ? "collection" : "all")
    const collectionId =
      searchParams.get("collectionId") || (context === "collection" ? assetData.category_tag_id : null)
    await loadNavAssets({ context, collectionId, currentAssetId: assetData.id, clientId: assetData.client_id })

    if (!soft) {
    setIsLoading(false)
    }
  }

  const loadActivity = async (assetId: string) => {
      const supabase = supabaseRef.current
    const { data } = await supabase
      .from("asset_events")
      .select("*")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false })
      .limit(20)

    setActivity(data || [])
  }

  const loadNavAssets = async ({
    context,
    collectionId,
    currentAssetId,
    clientId,
  }: {
    context: string
    collectionId: string | null
    currentAssetId: string
    clientId: string
  }) => {
    const supabase = supabaseRef.current

    let query = supabase
      .from("assets")
      .select("id, client_id, title, storage_path, mime_type, created_at, category_tag_id, status")
      .eq("status", "active")

    if (context === "collection" && collectionId) {
      query = query.eq("category_tag_id", collectionId)
    } else {
      query = query.eq("client_id", clientId)
    }

    const { data } = await query.order("created_at", { ascending: false })
    if (!data) return

    setNavAssets(data as Asset[])
    const idx = data.findIndex((a: { id: string }) => a.id === currentAssetId)
    setNavIndex(idx)
  }

  const goToNeighbor = (direction: -1 | 1) => {
    if (navIndex < 0) return
    const nextIndex = navIndex + direction
    if (nextIndex < 0 || nextIndex >= navAssets.length) return
    const nextAsset = navAssets[nextIndex]
    const context = searchParams.get("context") || (asset?.category_tag_id ? "collection" : "all")
    const collectionId =
      searchParams.get("collectionId") || (context === "collection" ? asset?.category_tag_id : null)
    const query = new URLSearchParams()
    query.set("context", context)
    if (collectionId) query.set("collectionId", collectionId)
    const targetUrl = `/assets/${nextAsset.id}?${query.toString()}`
    startNavigation(async () => {
      window.history.replaceState(null, "", targetUrl)
      await loadAsset(nextAsset.id, true)
    })
  }

  // Prefetch neighbor routes for smoother navigation
  useEffect(() => {
    const context = searchContext || (asset?.category_tag_id ? "collection" : "all")
    const collectionId =
      searchCollectionId || (context === "collection" ? asset?.category_tag_id : null)
    const buildUrl = (assetId: string) => {
      const q = new URLSearchParams()
      q.set("context", context)
      if (collectionId) q.set("collectionId", collectionId)
      return `/assets/${assetId}?${q.toString()}`
    }
    if (navIndex > 0) {
      router.prefetch(buildUrl(navAssets[navIndex - 1].id))
    }
    if (navIndex >= 0 && navIndex < navAssets.length - 1) {
      router.prefetch(buildUrl(navAssets[navIndex + 1].id))
    }
  }, [navIndex, navAssets, asset?.category_tag_id, searchContext, searchCollectionId, router])

  const loadVersions = async (assetId: string) => {
    try {
      const supabase = supabaseRef.current
      const { data, error } = await supabase
      .from("asset_versions")
      .select(
        "id, version_label, storage_path, storage_bucket, mime_type, width, height, dpi, file_size, created_at",
      )
        .eq("asset_id", assetId)
      .order("created_at", { ascending: false })

      // Handle gracefully - table might not exist (PGRST205) or no versions (PGRST116)
      // Silently ignore these expected errors
      if (error && error.code !== "PGRST116" && error.code !== "PGRST205") {
        console.error("Error loading versions:", error)
      }
    setVersions(data || [])
    } catch (err) {
      // Silently ignore - table doesn't exist or other non-critical errors
      setVersions([])
    }
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
    await loadActivity(asset.id)
  }

  const handleRestorePrevious = async () => {
    if (!asset?.previous_version_id) return
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: prevVersion, error } = await supabase
      .from("asset_versions")
      .select("*")
      .eq("id", asset.previous_version_id)
      .single()
    if (error || !prevVersion) {
      setErrorMessage("Previous version not found.")
      return
    }

    const updatePayload = {
      current_version_id: prevVersion.id,
      previous_version_id: asset.current_version_id ?? null,
      storage_path: prevVersion.storage_path,
      storage_bucket: prevVersion.storage_bucket,
      mime_type: prevVersion.mime_type || asset.mime_type,
      file_size: prevVersion.file_size ?? asset.file_size,
      width: prevVersion.width ?? asset.width,
      height: prevVersion.height ?? asset.height,
    }

    const { error: updateError } = await supabase.from("assets").update(updatePayload).eq("id", asset.id)
    if (updateError) {
      setErrorMessage("Failed to restore previous version.")
      return
    }

    await supabase
      .from("asset_events")
      .insert({ asset_id: asset.id, client_id: asset.client_id, user_id: user.id, event_type: "restore", source: "web" })

    await loadAsset(asset.id, false)
  }

  const handleReplaceInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0]
    e.target.value = ""
    if (!newFile || !asset) return

    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setIsReplacing(true)
    setErrorMessage(null)

    try {
      let dimensions: { width: number; height: number; duration?: number } | null = null
      if (newFile.type.startsWith("image/")) {
        dimensions = await getImageDimensions(newFile)
      } else if (newFile.type.startsWith("video/")) {
        dimensions = await getVideoDimensions(newFile)
      }

      const uploadResult = await uploadAsset({
        clientId: asset.client_id,
        file: newFile,
      })

      // Move current -> previous, set new current
      const { data: newVersion, error: versionError } = await supabase
        .from("asset_versions")
        .insert({
          asset_id: asset.id,
          client_id: asset.client_id,
          version_label: "replace",
          storage_bucket: "assets",
          storage_path: uploadResult.path,
          mime_type: newFile.type,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
          file_size: newFile.size,
          created_by: user.id,
        })
        .select("id")
        .single()

      if (versionError || !newVersion) {
        setErrorMessage("Failed to create new version.")
        return
      }

      const updatePayload = {
        previous_version_id: asset.current_version_id ?? null,
        current_version_id: newVersion.id,
        storage_path: uploadResult.path,
        storage_bucket: "assets",
        mime_type: newFile.type,
        file_size: newFile.size,
        width: dimensions?.width || null,
        height: dimensions?.height || null,
      }

      const { error: updateError } = await supabase.from("assets").update(updatePayload).eq("id", asset.id)
      if (updateError) {
        setErrorMessage("Failed to update asset with new version.")
        return
      }

      await supabase
        .from("asset_events")
        .insert({ asset_id: asset.id, client_id: asset.client_id, user_id: user.id, event_type: "replace", source: "web" })

      await loadAsset(asset.id, false)
    } catch (err) {
      console.error("Replace failed:", err)
      setErrorMessage("Failed to replace file.")
    } finally {
      setIsReplacing(false)
    }
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

  const handleVideoPresetDownload = async (presetId: string) => {
    const preset = videoPresetOptions.find((p) => p.id === presetId)
    if (!preset) return

    // For now, all video presets download the original file
    // Later we can implement actual video transcoding based on quality
    await downloadOriginal({
      kind: "original",
      quality: preset.quality,
      label: preset.label
    })
  }

  const handleVideoCustomDownload = async () => {
    if (!videoWidth || !videoHeight) {
      setErrorMessage("Angiv både bredde og højde for custom video export.")
      return
    }
    const width = Number(videoWidth)
    const height = Number(videoHeight)
    if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
      setErrorMessage("Bredde og højde skal være gyldige tal større end 0.")
      return
    }
    setIsDownloadingVideoCustom(true)

    // For now, download original file with custom dimensions label
    // Later we can implement actual video transcoding
    await downloadOriginal({
      kind: "custom",
      width,
      height,
      format: videoFormat,
      label: `Custom ${width}x${height} ${videoFormat.toUpperCase()}`
    })

    setIsDownloadingVideoCustom(false)
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

  const handleDownloadPrevious = async () => {
    if (!asset || !previousPreviewUrl || !previousVersion) return
    const res = await fetch(previousPreviewUrl)
    const blob = await res.blob()
    downloadBlob(blob, `${asset.title || "asset"}-previous`)
    await logAssetEvent("download", { kind: "previous" })
  }

  const previewUrl = useMemo(() => {
    if (!storageData?.signedUrl || !asset?.storage_path) return null
    // Return the signed URL since we know it matches the current asset
    return storageData.signedUrl
  }, [storageData?.signedUrl, asset?.storage_path])

  const isImage = asset?.mime_type?.startsWith("image/")
  const isVideo = asset?.mime_type?.startsWith("video/")
  const isPdf = asset?.mime_type === "application/pdf"

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f6]">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#DF475C] border-t-transparent" />
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
          <div className="mb-6 flex w-full items-center justify-between text-sm text-gray-500">
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
              className={`flex h-10 w-10 items-center justify-center rounded-full border cursor-pointer ${isFavorited ? "border-rose-200 bg-rose-50 text-rose-500" : "border-gray-200 bg-white text-gray-500"} shadow-sm transition hover:border-rose-200 hover:text-rose-200`}
            >
              <Heart className={`h-5 w-5 ${isFavorited ? "fill-rose-500" : ""}`} />
            </button>
        </div>

          {/* Hidden file input for replace (used by version dropup) */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            className="hidden"
            onChange={handleReplaceInputChange}
          />


          {/* Asset Preview - Centered */}
          <div className="flex flex-1 items-center justify-center min-h-0">
            <div className="w-full flex items-center justify-center">
              {previewUrl ? (
                <>
                  {isImage && (
                    <img key={asset.id} src={previewUrl} alt={asset.title} className="max-h-[72vh] max-w-full object-contain" />
                  )}
                  {isVideo && (
                    <video
                      key={asset.id}
                      src={previewUrl}
                      controls
                      className="max-h-[72vh] max-w-full object-contain rounded-2xl"
                      preload="metadata"
                      crossOrigin="anonymous"
                      onError={async (e) => {
                        const videoEl = e.target as HTMLVideoElement
                        const currentSrc = videoEl.src
                        const expectedPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
                        
                        // Only log if URL doesn't match current asset
                        if (!currentSrc.includes(expectedPath)) {
                          console.warn("Video URL mismatch - clearing and reloading")
                          setStorageData(null)
                          setVideoErrorCount(0)
                          return
                        }

                        // Retry once with a fresh signed URL
                        if (asset && videoErrorCount < 1) {
                          setVideoErrorCount((c) => c + 1)
                          const supabase = supabaseRef.current
                          const cleanPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
                          // Use proxy endpoint instead of direct signed URL
                          const storageUrl = { signedUrl: `/api/assets/${encodeURIComponent(cleanPath)}` }
                          setStorageData(storageUrl)
                          return
                        }

                        setErrorMessage("Failed to load video. The file may not exist or be corrupted.")
                      }}
                      onLoadStart={() => {
                        // Only log if URL matches current asset
                        const expectedPath = asset.storage_path.replace(/^\/+|\/+$/g, "")
                        if (previewUrl?.includes(expectedPath)) {
                          console.log("Video loading started for asset:", asset.id)
                        }
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {isPdf && (
                    <iframe
                      key={asset.id}
                      src={`${previewUrl}#view=Fit`}
                      className="h-[72vh] w-full rounded-2xl border-0"
                      title={asset.title}
                    />
                  )}
                </>
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500">
                  {previewUrl ? "Loading preview..." : "Preview not available"}
                </div>
              )}
            </div>
          </div>

        {/* Navigation bar - positioned above download toolbar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center">
          <div className="pointer-events-auto px-6">
            <div className="inline-flex items-center justify-center gap-4 rounded-full border border-gray-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-300"
                disabled={navIndex <= 0}
                onClick={() => goToNeighbor(-1)}
              >
            <ArrowLeft className="h-4 w-4" />
          </Button>
              <span className="min-w-[64px] text-center text-sm font-medium text-gray-800">
                {navIndex >= 0 ? navIndex + 1 : "-"} / {navAssets.length || "-"}
                {isNavigating ? " · Loading…" : ""}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-300"
                disabled={navIndex < 0 || navIndex >= navAssets.length - 1}
                onClick={() => goToNeighbor(1)}
              >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <div className="pointer-events-auto px-4">
            <div className="inline-flex items-center justify-center gap-3 rounded-[18px] border border-gray-200 bg-white/96 px-4 py-3 shadow-lg backdrop-blur sm:px-5">
              {/* Version dropup (left) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 rounded-full">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Version</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  className="w-64 rounded-3xl border border-gray-100 bg-white/98 shadow-[0_20px_70px_-20px_rgba(15,23,42,0.25)] backdrop-blur"
                >
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                    Versioning
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                    onSelect={() => fileInputRef.current?.click()}
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-gray-500" />
                      <span>Replace file</span>
              </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!asset.previous_version_id}
                    className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                    onSelect={() => handleRestorePrevious()}
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-gray-500" />
                      <span>Restore previous</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Edit (transform) dropup */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 rounded-full">
                    <Wand2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </DropdownMenuTrigger>
                {isImage && (
                  <DropdownMenuContent
                    align="center"
                    side="top"
                    className="w-72 rounded-3xl border border-gray-100 bg-white/98 shadow-[0_20px_70px_-20px_rgba(15,23,42,0.25)] backdrop-blur"
                  >
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                      Crop / Transform
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                      onSelect={() => {
                        handleCustomDownload()
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                        <span>Apply custom resize (download)</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                      onSelect={() => {
                        handlePresetDownload()
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-gray-500" />
                        <span>Apply current preset download</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                )}
              </DropdownMenu>

              {/* Download dropup (right, primary) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex items-center gap-2 rounded-full bg-[#e65872] text-white hover:bg-[#d74f68] border-transparent">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  className="w-80 rounded-3xl border border-gray-100 bg-white/98 shadow-[0_20px_70px_-20px_rgba(15,23,42,0.25)] backdrop-blur"
                >
                  {isImage ? (
                    <>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                        Image Presets
                      </DropdownMenuLabel>
                      {presetOptions.map((preset) => (
                        <DropdownMenuItem
                          key={preset.id}
                          className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                          onSelect={() => {
                            setSelectedPresetId(preset.id)
                            void handlePresetDownload()
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-gray-500" />
                            <span>{preset.label}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                        Custom Resize
                      </DropdownMenuLabel>
                      <div className="px-2 pb-2 pt-1 space-y-2">
                        <Select value={customFormat} onValueChange={setCustomFormat}>
                          <SelectTrigger className="h-10 w-full rounded-full border border-gray-200 bg-white text-xs shadow-sm transition hover:border-gray-300">
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border border-gray-200 bg-white/98 shadow-2xl backdrop-blur">
                            {formatOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={customWidth}
                            onChange={(e) => setCustomWidth(e.target.value)}
                            placeholder="W"
                            className="h-10 rounded-full border border-gray-200 bg-white px-3 text-xs shadow-sm"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={customHeight}
                            onChange={(e) => setCustomHeight(e.target.value)}
                            placeholder="H"
                            className="h-10 rounded-full border border-gray-200 bg-white px-3 text-xs shadow-sm"
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-10 w-full rounded-full bg-[#e65872] text-white hover:bg-[#d74f68]"
                          onClick={handleCustomDownload}
                          disabled={isDownloadingCustom}
                        >
                          {isDownloadingCustom ? "Downloading…" : "Download custom"}
                        </Button>
                      </div>
                    </>
                  ) : isVideo ? (
                    <>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                        Video Presets
                      </DropdownMenuLabel>
                      {videoPresetOptions.map((preset) => (
                        <DropdownMenuItem
                          key={preset.id}
                          className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                          onSelect={() => {
                            void handleVideoPresetDownload(preset.id)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-gray-500" />
                            <span>{preset.label}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                        Custom Video
                      </DropdownMenuLabel>
                      <div className="px-2 pb-2 pt-1 space-y-2">
                        <Select value={videoFormat} onValueChange={setVideoFormat}>
                          <SelectTrigger className="h-10 w-full rounded-full border border-gray-200 bg-white text-xs shadow-sm transition hover:border-gray-300">
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border border-gray-200 bg-white/98 shadow-2xl backdrop-blur">
                            {videoFormatOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={videoWidth}
                            onChange={(e) => setVideoWidth(e.target.value)}
                            placeholder="W"
                            className="h-10 rounded-full border border-gray-200 bg-white px-3 text-xs shadow-sm"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={videoHeight}
                            onChange={(e) => setVideoHeight(e.target.value)}
                            placeholder="H"
                            className="h-10 rounded-full border border-gray-200 bg-white px-3 text-xs shadow-sm"
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-10 w-full rounded-full bg-[#e65872] text-white hover:bg-[#d74f68]"
                          onClick={handleVideoCustomDownload}
                          disabled={isDownloadingVideoCustom}
                        >
                          {isDownloadingVideoCustom ? "Downloading…" : "Download custom video"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-400">
                        Download Options
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className="cursor-pointer text-sm rounded-2xl px-3 py-2.5 text-gray-800 focus:bg-gray-100"
                        onSelect={() => {
                          void downloadOriginal({ kind: "original" })
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4 text-gray-500" />
                          <span>Download original PDF</span>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        {/* End toolbar */}
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
