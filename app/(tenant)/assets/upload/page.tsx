"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { uploadAsset, getImageDimensions, getVideoDimensions, generateVideoThumbnail } from "@/lib/utils/storage"
import { getFileTypeFromMimeType } from "@/lib/utils/file-type-detector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Upload, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useTenant } from "@/lib/context/tenant-context"

interface Tag {
  id: string
  tag_type: string
  label: string
  slug: string
}

export default function UploadAssetPage() {
  const { tenant } = useTenant()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [categoryTag, setCategoryTag] = useState<string>("")
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
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
    initializeAndLoadTags()
  }, [tenant]) // Re-run when tenant changes

  const initializeAndLoadTags = async () => {
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

      // Use tenant context for client ID instead of looking up client_users
      // This ensures we get tags for the current tenant/subdomain
      const clientId = tenant.id
      setClientId(clientId)

      // Fetch tags (client-specific OR system tags)
      const { data: tags } = await supabase
        .from("tags")
        .select("id, tag_type, label, slug")
        .or(`client_id.eq.${clientId},client_id.is.null`)
        .order("tag_type")
        .order("sort_order")

      if (tags) {
        setAvailableTags(tags)
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

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a file")
      return
    }

    if (!categoryTag) {
      setError("Please select a category for this asset")
      return
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
              onProgress: () => {}, // No progress for thumbnail
            })
            thumbnailPath = thumbnailUploadResult.path
          }
        } catch (error) {
          console.warn("Failed to generate video thumbnail:", error)
          // Continue without thumbnail - not critical
        }
      }

      setUploadProgress(85)

      const { data: newAsset, error: dbError } = await supabase
        .from("assets")
        .insert({
          client_id: clientId,
          uploaded_by: userId,
          title: title.trim() || file.name,
          description: description.trim() || null,
          storage_bucket: "assets",
          storage_path: uploadResult.path,
          mime_type: file.type,
          file_size: file.size,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
          duration_seconds: dimensions?.duration || null,
          category_tag_id: categoryTag || null,
          status: "active",
        })
        .select("id")
        .single()

      if (dbError) throw dbError

      setUploadProgress(90)

      // Create initial asset_version and set as current_version_id
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

      // Auto-assign file_type tag based on mime_type
      const fileTypeSlug = getFileTypeFromMimeType(file.type)
      if (fileTypeSlug) {
        // Find the file_type tag (system tag, available to all clients)
        const { data: fileTypeTag } = await supabase
          .from("tags")
          .select("id")
          .eq("tag_type", "file_type")
          .eq("slug", fileTypeSlug)
          .eq("is_system", true)
          .maybeSingle()

        if (fileTypeTag) {
          const { error: fileTypeTagError } = await supabase.from("asset_tags").insert({
            asset_id: newAsset.id,
            tag_id: fileTypeTag.id,
          })
          if (fileTypeTagError) {
            console.error("File type tag assignment error:", fileTypeTagError)
          } else {
          }
        }
      }

      if (selectedTags.length > 0) {
        const tagInserts = selectedTags.map((tagId) => ({
          asset_id: newAsset.id,
          tag_id: tagId,
        }))

        const { error: tagError } = await supabase.from("asset_tags").insert(tagInserts)
        if (tagError) console.error("Tag insertion error:", tagError)
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

  // Category tags - show ALL category tags (system + client-specific)
  const categoryTags = availableTags.filter((t) => t.tag_type === "category")

  // Description tags - show ALL description tags (system + client-specific)
  const descriptionTags = availableTags.filter((t) => t.tag_type === "description")

  // Usage tags - show ALL usage tags (system + client-specific)
  const usageTags = availableTags.filter((t) => t.tag_type === "usage")

  // Visual style tags - show ALL visual_style tags (system + client-specific)
  const visualStyleTags = availableTags.filter((t) => t.tag_type === "visual_style")


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

  return (
    <div className="p-8">
      <div className="mb-8">
        <button
          onClick={() => router.push('/assets')}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to assets
        </button>
      </div>

      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Upload asset</CardTitle>
          <CardDescription>Upload a new asset and organize it with tags</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">File *</Label>
              <div className="flex">
              <Input
                id="file"
                type="file"
                required
                onChange={handleFileChange}
                accept="image/*,video/*,application/pdf"
                disabled={isLoading}
                  className="hidden"
                />
                <label
                  htmlFor="file"
                  className="flex-1 cursor-pointer inline-flex items-center justify-start px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose file
                </label>
              </div>
              {file && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                  {preview && (
                    <div className="mt-4">
                      <img src={preview || "/placeholder.svg"} alt="Preview" className="max-h-48 rounded-lg border" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Asset title"
                disabled={isLoading}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this asset"
                rows={3}
                disabled={isLoading}
              />
            </div>

            {/* Category Tag (single select) */}
            {categoryTags.length > 0 && (
              <div className="space-y-2">
                <Label>
                  Category <span style={{ color: tenant.primary_color }}>*</span>
                </Label>
                <p className="text-sm text-gray-500">Select a category to organize this asset into a collection</p>
                <div className="flex flex-wrap gap-2">
                  {categoryTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setCategoryTag(tag.id === categoryTag ? "" : tag.id)}
                      disabled={isLoading}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        categoryTag === tag.id
                          ? `border-[${tenant.primary_color}] text-white`
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                      style={categoryTag === tag.id ? { backgroundColor: tenant.primary_color } : {}}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
                {!categoryTag && error?.includes("category") && (
                  <p className="text-sm" style={{ color: tenant.primary_color }}>Please select a category</p>
                )}
              </div>
            )}

            {/* Description Tags (multi-select) */}
            {descriptionTags.length > 0 && (
              <div className="space-y-2">
                <Label>Description tags</Label>
                <div className="flex flex-wrap gap-2">
                  {descriptionTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      disabled={isLoading}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        selectedTags.includes(tag.id)
                          ? "text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                      style={selectedTags.includes(tag.id) ? {
                        backgroundColor: tenant.primary_color,
                        borderColor: tenant.primary_color
                      } : {}}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Tags (multi-select) */}
            {usageTags.length > 0 && (
              <div className="space-y-2">
                <Label>Usage / Purpose</Label>
                <div className="flex flex-wrap gap-2">
                  {usageTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      disabled={isLoading}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        selectedTags.includes(tag.id)
                          ? "text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                      style={selectedTags.includes(tag.id) ? {
                        backgroundColor: tenant.primary_color,
                        borderColor: tenant.primary_color
                      } : {}}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Style Tags (multi-select) */}
            {visualStyleTags.length > 0 && (
              <div className="space-y-2">
                <Label>Visual style</Label>
                <div className="flex flex-wrap gap-2">
                  {visualStyleTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      disabled={isLoading}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        selectedTags.includes(tag.id)
                          ? "text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                      style={selectedTags.includes(tag.id) ? {
                        backgroundColor: tenant.primary_color,
                        borderColor: tenant.primary_color
                      } : {}}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isLoading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {uploadProgress < 30 && "Preparing..."}
                    {uploadProgress >= 30 && uploadProgress < 80 && "Uploading..."}
                    {uploadProgress >= 80 && "Saving..."}
                  </span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%`, backgroundColor: tenant.primary_color }}
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Upload successful! Redirecting...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Link href="/assets">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="rounded-[25px]"
                style={{
                  backgroundColor: tenant.primary_color,
                  borderColor: tenant.primary_color
                }}
                disabled={isLoading || success || !clientId}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isLoading ? "Uploading..." : "Upload asset"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
