"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { uploadAsset, getImageDimensions, getVideoDimensions, generateVideoThumbnail } from "@/lib/utils/storage"
import { getFileTypeFromMimeType } from "@/lib/utils/file-type-detector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Upload, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { TagBadgeSelector } from "@/components/tag-badge-selector"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { TagDimension } from "@/lib/types/database"

export default function UploadAssetPage() {
  const { tenant } = useTenant()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  
  // Dynamic tag selections - keyed by dimension_key
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({})
  
  const [tagDimensions, setTagDimensions] = useState<TagDimension[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    initializeAndLoadDimensions()
  }, [tenant])

  const initializeAndLoadDimensions = async () => {
    try {
      const supabase = supabaseRef.current
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error("User not authenticated:", userError)
        router.push("/login")
        return
      }

      setUserId(user.id)
      const clientId = tenant.id
      setClientId(clientId)

      // Load tag dimensions configuration
      const { data: dimensions, error: dimError } = await supabase
        .from("tag_dimensions")
        .select("*")
        .order("display_order", { ascending: true })

      if (dimError) {
        console.error("Error loading tag dimensions:", dimError)
        // Fallback: create default dimensions if table doesn't exist yet
        setTagDimensions([])
      } else {
        setTagDimensions(dimensions || [])
      }
    } catch (err) {
      console.error("Initialization error:", err)
      setError("Failed to initialize upload page")
    } finally {
      setIsInitializing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)

      // Generate preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(selectedFile)
      } else {
        setPreview(null)
      }

      // Auto-fill title if empty
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, "")) // Remove extension
      }
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      setFile(droppedFile)

      // Generate preview for images
      if (droppedFile.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(droppedFile)
      } else {
        setPreview(null)
      }

      // Auto-fill title if empty
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, "")) // Remove extension
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const toggleTag = (dimensionKey: string, tagId: string) => {
    setSelectedTags((prev) => {
      const current = prev[dimensionKey] || []
      if (current.includes(tagId)) {
        return {
          ...prev,
          [dimensionKey]: current.filter((id) => id !== tagId),
        }
      } else {
        return {
          ...prev,
          [dimensionKey]: [...current, tagId],
        }
      }
    })
  }

  const getSelectedTags = (dimensionKey: string): string[] => {
    return selectedTags[dimensionKey] || []
  }

  // Generic tag creation handler
  const createTagHandler = (dimension: TagDimension) => {
    if (!dimension.allow_user_creation) return undefined

    return async (label: string): Promise<string | null> => {
      const supabase = supabaseRef.current
      let parentId: string | null = null

      if (dimension.is_hierarchical) {
        const { data: parentTag } = await supabase
          .from("tags")
          .select("id")
          .eq("dimension_key", dimension.dimension_key)
          .is("parent_id", null)
          .or(`client_id.eq.${clientId},client_id.is.null`)
          .maybeSingle()
        parentId = parentTag?.id || null
      }

      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

      // Check if tag already exists before creating
      const { data: existing } = await supabase
        .from("tags")
        .select("id")
        .eq("dimension_key", dimension.dimension_key)
        .eq("slug", slug)
        .or(`client_id.eq.${clientId},client_id.is.null`)
        .maybeSingle()

      if (existing) {
        return existing.id
      }

      // Determine tag_type based on dimension_key (for backward compatibility)
      let tagType = "description"
      if (dimension.dimension_key === "campaign" || dimension.dimension_key === "brand_assets") {
        tagType = "category"
      } else if (dimension.dimension_key === "visual_style") {
        tagType = "visual_style"
      } else if (dimension.dimension_key === "usage") {
        tagType = "usage"
      }

      const { data, error } = await supabase
        .from("tags")
        .insert({
          client_id: clientId!,
          dimension_key: dimension.dimension_key,
          parent_id: parentId,
          label: label.trim(),
          slug,
          is_system: false,
          sort_order: 0,
          created_by: userId,
          tag_type: tagType,
        })
        .select("id")
        .single()

      return error ? null : data?.id || null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a file")
      return
    }

    // Validate: At least one organizational tag is required
    const organizationDimensions = tagDimensions.filter(
      (d) => (d.generates_collection || d.dimension_key === "department") && d.dimension_key !== "file_type"
    )
    
    if (organizationDimensions.length > 0) {
      const hasOrgTag = organizationDimensions.some(
        (dim) => (selectedTags[dim.dimension_key] || []).length > 0
      )
      
      if (!hasOrgTag) {
        setError("Please select at least one organizational tag")
      return
      }
    }

    if (!clientId || !userId) {
      setError("Session expired. Please refresh the page.")
      return
    }

    const supabase = supabaseRef.current
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      setUploadProgress(10)

      let dimensions: { width: number; height: number; duration?: number } | null = null

      if (file.type.startsWith("image/")) {
        dimensions = await getImageDimensions(file)
      } else if (file.type.startsWith("video/")) {
        dimensions = await getVideoDimensions(file)
      }

      setUploadProgress(25)

      const uploadResult = await uploadAsset({
        clientId,
        file,
        onProgress: (progress) => {
          setUploadProgress(25 + (progress * 50) / 100)
        },
      })

      setUploadProgress(75)

      // Generate thumbnail for video files
      let thumbnailPath: string | null = null
      if (file.type.startsWith("video/")) {
        try {
          const thumbnailFile = await generateVideoThumbnail(file)
          if (thumbnailFile) {
            const thumbnailUploadResult = await uploadAsset({
              clientId,
              file: thumbnailFile,
              onProgress: () => {},
            })
            thumbnailPath = thumbnailUploadResult.path
          }
        } catch (error) {
          console.warn("Failed to generate video thumbnail:", error)
        }
      }

      setUploadProgress(85)

      // Create asset (no category_tag_id - all tags go through junction table)
      const { data: newAsset, error: dbError } = await supabase
        .from("assets")
        .insert({
          client_id: clientId,
          uploaded_by: userId,
          title: title.trim() || file.name || "Untitled",
          description: null,
          storage_bucket: "assets",
          storage_path: uploadResult.path,
          mime_type: file.type,
          file_size: file.size,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
          duration_seconds: dimensions?.duration || null,
          status: "active",
        })
        .select("id")
        .single()

      if (dbError) throw dbError

      setUploadProgress(90)

      // Create initial asset_version
      const { data: versionData, error: versionError } = await supabase
        .from("asset_versions")
        .insert({
          asset_id: newAsset.id,
          client_id: clientId,
          version_label: "initial",
          storage_bucket: "assets",
          storage_path: uploadResult.path,
          mime_type: file.type,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
          dpi: null,
          file_size: file.size,
          thumbnail_path: thumbnailPath,
          created_by: userId,
        })
        .select("id")
        .single()

      if (versionError) {
        console.error("Failed to create initial asset version:", versionError)
      } else {
        await supabase
          .from("assets")
          .update({ current_version_id: versionData.id, previous_version_id: null })
          .eq("id", newAsset.id)
      }

      // Collect all selected tags dynamically
      const allTagIds: string[] = []
      Object.values(selectedTags).forEach((tagIds) => {
        allTagIds.push(...tagIds)
      })

      // Auto-assign file_type tag
      const fileTypeSlug = getFileTypeFromMimeType(file.type)
      if (fileTypeSlug) {
        const { data: fileTypeTag } = await supabase
          .from("tags")
          .select("id")
          .eq("dimension_key", "file_type")
          .eq("slug", fileTypeSlug)
          .or(`client_id.eq.${clientId},client_id.is.null`)
          .maybeSingle()

        if (fileTypeTag && !allTagIds.includes(fileTypeTag.id)) {
          allTagIds.push(fileTypeTag.id)
        }
      }

      // Insert all tags through junction table
      if (allTagIds.length > 0) {
        const tagInserts = allTagIds.map((tagId) => ({
          asset_id: newAsset.id,
          tag_id: tagId,
        }))

        const { error: tagError } = await supabase.from("asset_tags").insert(tagInserts)
        if (tagError) {
          console.error("Tag insertion error:", tagError)
        }
      }

      setUploadProgress(95)

      await supabase.from("asset_events").insert({
        asset_id: newAsset.id,
        client_id: clientId,
        user_id: userId,
        event_type: "upload",
        source: "web",
      })

      setUploadProgress(100)
      setSuccess(true)

      setTimeout(() => {
        router.push("/assets")
      }, 1500)
    } catch (error: unknown) {
      console.error("Upload error:", error)
      setError(error instanceof Error ? error.message : "An error occurred during upload")
      setUploadProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate grid columns based on number of organizational dimensions
  const getGridCols = (count: number) => {
    if (count === 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-1 md:grid-cols-2"
    if (count === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    if (count === 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  }

  if (isInitializing) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: tenant.primary_color }} />
          <p className="text-gray-600">Loading upload page...</p>
        </div>
      </div>
    )
  }

  // Group dimensions by type
  const organizationDimensions = tagDimensions.filter(
    (d) => (d.generates_collection || d.dimension_key === "department") && d.dimension_key !== "file_type"
  )
  const descriptiveDimensions = tagDimensions.filter(
    (d) => !d.generates_collection && d.dimension_key !== "department" && d.dimension_key !== "file_type" && d.dimension_key !== "content_type"
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
      <div className="mb-8">
        <button
            onClick={() => router.push("/assets")}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to assets
        </button>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Upload asset</h1>
      </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* Left Column - Preview */}
            <div className="lg:col-span-2">
              <div className="sticky top-8">
                {/* File Upload Area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`relative group rounded-xl border-2 border-dashed transition-all ${
                    file
                      ? "border-gray-200 bg-gray-50/50"
                      : "border-gray-200 bg-gray-50/30 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
              <Input
                id="file"
                type="file"
                required
                onChange={handleFileChange}
                accept="image/*,video/*,application/pdf"
                disabled={isLoading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {preview ? (
                    <div className="p-6">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
              </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-900 truncate">{file?.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file?.size ? file.size / 1024 / 1024 : 0).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 group-hover:bg-gray-200 transition-colors mb-4">
                        <Upload className="h-7 w-7 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Drop file here</p>
                      <p className="text-xs text-gray-500">or click to browse</p>
                      <p className="text-xs text-gray-400 mt-2">Images, videos, PDFs</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="lg:col-span-3">
              <div className="space-y-8">
                {/* Basic Information */}
                <div>
                  <div className="mb-6">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Details</h2>
                  </div>

                  <div className="space-y-6">
            {/* Title */}
                    <div>
                      <Label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-gray-400 text-xs">(optional)</span>
                      </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter asset title (leave empty to use filename)"
                disabled={isLoading}
                        className="w-full"
              />
            </div>
                  </div>
                </div>

                {/* Organization Tags */}
                {organizationDimensions.length > 0 && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                        Organization
                        <span className="ml-2 text-red-500 normal-case" title="Required - select at least one organizational tag">
                          *
                        </span>
                      </h2>
                </div>
                    <div className={`grid ${getGridCols(organizationDimensions.length)} gap-6`}>
                      {organizationDimensions.map((dimension) => (
                        <div key={dimension.dimension_key}>
                          <TagBadgeSelector
                            dimension={dimension}
                            selectedTagIds={getSelectedTags(dimension.dimension_key)}
                            onToggle={(tagId) => toggleTag(dimension.dimension_key, tagId)}
                            onCreate={createTagHandler(dimension)}
                            clientId={clientId!}
                            userId={userId}
                          />
              </div>
                  ))}
                </div>
              </div>
            )}

                {/* Descriptive Tags */}
                {descriptiveDimensions.length > 0 && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Additional Tags</h2>
                    </div>
                    <Accordion type="single" collapsible className="w-full">
                      {descriptiveDimensions.map((dimension) => (
                        <AccordionItem key={dimension.dimension_key} value={dimension.dimension_key} className="border-gray-200">
                          <AccordionTrigger className="text-sm font-medium text-gray-700 hover:no-underline py-3">
                            {dimension.label}
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-4">
                            <TagBadgeSelector
                              dimension={dimension}
                              selectedTagIds={getSelectedTags(dimension.dimension_key)}
                              onToggle={(tagId) => toggleTag(dimension.dimension_key, tagId)}
                              onCreate={createTagHandler(dimension)}
                              clientId={clientId!}
                              userId={userId}
                            />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
              </div>
            )}

            {/* Upload Progress */}
            {isLoading && uploadProgress > 0 && (
                  <div className="space-y-3 rounded-lg bg-blue-50/50 p-4 border border-blue-100">
                <div className="flex justify-between text-sm">
                      <span className="text-blue-700 font-medium">
                    {uploadProgress < 30 && "Preparing..."}
                    {uploadProgress >= 30 && uploadProgress < 80 && "Uploading..."}
                    {uploadProgress >= 80 && "Saving..."}
                  </span>
                      <span className="font-semibold text-blue-900">{uploadProgress}%</span>
                </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                  <div
                        className="h-full transition-all duration-300 bg-blue-600"
                        style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Upload successful! Redirecting...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
                  <div className="rounded-lg bg-red-50 p-4 text-red-800 border border-red-200">
                    <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
                <div className="flex justify-end gap-3 pt-8 border-t border-gray-200">
              <Link href="/assets">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                style={{
                  backgroundColor: tenant.primary_color,
                      borderColor: tenant.primary_color,
                }}
                disabled={isLoading || success || !clientId}
              >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                <Upload className="mr-2 h-4 w-4" />
                        Upload asset
                      </>
                    )}
              </Button>
                </div>
              </div>
            </div>
            </div>
          </form>
      </div>
    </div>
  )
}
