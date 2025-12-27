"use client"

import React from "react"
import { createClient } from "@/lib/supabase/client"
import { uploadAsset, getImageDimensions, getVideoDimensions, generateVideoThumbnail } from "@/lib/utils/storage"
import { getFileTypeFromMimeType } from "@/lib/utils/file-type-detector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Upload, X, CheckCircle, Loader2, ArrowLeft, ArrowRight, FileText } from "lucide-react"
import { Stepper } from "react-form-stepper"
import { useState, useEffect, useRef } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { TagBadgeSelector } from "@/components/tag-badge-selector"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { TagDimension } from "@/lib/types/database"
import { createTagHandler as createTagHandlerUtil } from "@/lib/utils/tag-creation"
import { logDebug, logError, logWarn } from "@/lib/utils/logger"

interface UploadAssetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface FileWithPreview extends File {
  preview?: string
  id: string
}

const steps = [
  { id: 1, label: "Bulk or single" },
  { id: 2, label: "Upload assets" },
  { id: 3, label: "Tagging" },
]

export function UploadAssetModal({ open, onOpenChange, onSuccess }: UploadAssetModalProps) {
  const { tenant } = useTenant()
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadType, setUploadType] = useState<"bulk" | "single">("single")
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  
  // Dynamic tag selections - keyed by dimension_key and file_id
  const [selectedTags, setSelectedTags] = useState<Record<string, Record<string, string[]>>>({})
  // Bulk tags - shared tags for all files in bulk upload
  const [bulkTags, setBulkTags] = useState<Record<string, string[]>>({})
  
  const [tagDimensions, setTagDimensions] = useState<TagDimension[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [success, setSuccess] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const isUploadingRef = useRef(false)

  useEffect(() => {
    if (open) {
      initializeAndLoadDimensions()
    } else {
      // Reset state when modal closes
      setCurrentStep(1)
      setUploadType("single")
      setFiles([])
      setTitles({})
      setSelectedTags({})
      setBulkTags({})
      setError(null)
      setSuccess(false)
      setUploadProgress({})
      isUploadingRef.current = false
    }
  }, [open])

  const initializeAndLoadDimensions = async () => {
    try {
      const supabase = supabaseRef.current
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        logError("User not authenticated:", userError)
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
        logError("Error loading tag dimensions:", dimError)
        setTagDimensions([])
      } else {
        setTagDimensions(dimensions || [])
      }
    } catch (err) {
      logError("Initialization error:", err)
      setError("Failed to initialize upload")
    } finally {
      setIsInitializing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      handleFiles(newFiles)
    }
  }

  const handleFiles = (newFiles: File[]) => {
    const filesWithPreview: FileWithPreview[] = newFiles.map((file, index) => {
      const fileWithId = file as FileWithPreview
      fileWithId.id = `${Date.now()}-${index}-${Math.random()}`
      
      // Generate preview for images
      if (file.type?.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.id === fileWithId.id) {
                // Preserve the File object and just add preview property
                const updated = f as FileWithPreview
                updated.preview = reader.result as string
                return updated
              }
              return f
            })
          )
        }
        reader.readAsDataURL(file)
      }
      
      // Auto-fill title if empty
      if (file.name) {
        const fileName = file.name.replace(/\.[^/.]+$/, "")
        setTitles((prev) => ({
          ...prev,
          [fileWithId.id]: fileName,
        }))
      }
      
      return fileWithId
    })

    if (uploadType === "single") {
      // For single, replace all files with just the first one
      setFiles(filesWithPreview.slice(0, 1))
    } else {
      // For bulk, add new files to existing ones
      setFiles((prev) => [...prev, ...filesWithPreview])
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      handleFiles(droppedFiles)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    setTitles((prev) => {
      const newTitles = { ...prev }
      delete newTitles[fileId]
      return newTitles
    })
    setSelectedTags((prev) => {
      const newTags = { ...prev }
      delete newTags[fileId]
      return newTags
    })
  }

  const toggleTag = (fileId: string, dimensionKey: string, tagId: string) => {
    if (uploadType === "bulk") {
      // In bulk mode, apply tags to all files
      setBulkTags((prev) => {
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
    } else {
      // In single mode, apply tags to specific file
      setSelectedTags((prev) => {
        const fileTags = prev[fileId] || {}
        const current = fileTags[dimensionKey] || []
        
        if (current.includes(tagId)) {
          return {
            ...prev,
            [fileId]: {
              ...fileTags,
              [dimensionKey]: current.filter((id) => id !== tagId),
            },
          }
        } else {
          return {
            ...prev,
            [fileId]: {
              ...fileTags,
              [dimensionKey]: [...current, tagId],
            },
          }
        }
      })
    }
  }

  const getSelectedTags = (fileId: string, dimensionKey: string): string[] => {
    if (uploadType === "bulk") {
      return bulkTags[dimensionKey] || []
    }
    return selectedTags[fileId]?.[dimensionKey] || []
  }

  // Generic tag creation handler using consolidated utility
  const getCreateTagHandler = (dimension: TagDimension, fileId?: string) => {
    return createTagHandlerUtil(supabaseRef.current, dimension, clientId!, userId!)
  }

  const getGridCols = (count: number) => {
    if (count === 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-1 md:grid-cols-2"
    if (count === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    if (count === 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  }

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      return files.length > 0
    }
    if (step === 2) {
      // Step 2 is always valid - titles are optional
      return true
    }
    if (step === 3) {
      // Validate that at least one collection-generating tag is selected
      const collectionGeneratingDimensions = tagDimensions.filter(
        (d) => d.generates_collection && d.dimension_key !== "file_type"
      )
      
      if (collectionGeneratingDimensions.length === 0) return true
      
      if (uploadType === "bulk") {
        // In bulk mode, check bulkTags
        return collectionGeneratingDimensions.some(
          (dim) => (bulkTags[dim.dimension_key] || []).length > 0
        )
      } else {
        // In single mode, check each file individually
        return files.every((file) => {
          const fileTags = selectedTags[file.id] || {}
          return collectionGeneratingDimensions.some(
            (dim) => (fileTags[dim.dimension_key] || []).length > 0
          )
        })
      }
    }
    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length))
      setError(null)
    } else {
      if (currentStep === 1) {
        setError("Please select at least one file")
      } else if (currentStep === 2) {
        setError("Please add a title for all files")
      } else if (currentStep === 3) {
        setError("Please select at least one collection-generating tag for each file")
      }
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  const handleSubmit = async () => {
    logDebug("handleSubmit called", { files: files.length, currentStep, uploadType, isLoading, isUploading: isUploadingRef.current })
    
    // Prevent multiple simultaneous uploads using ref (works even before state updates)
    if (isLoading || isUploadingRef.current) {
      logDebug("Upload already in progress, ignoring duplicate call")
      return
    }
    
    if (!validateStep(3)) {
      logDebug("Validation failed for step 3")
      setError("Please complete all required fields")
      return
    }

    if (!clientId || !userId) {
      logError("Missing clientId or userId", { clientId, userId })
      setError("Session expired. Please refresh the page.")
      return
    }

    if (files.length === 0) {
      logError("No files to upload")
      setError("Please select at least one file")
      return
    }

    // Set both state and ref immediately to prevent duplicate calls
    isUploadingRef.current = true
    setIsLoading(true)
    setError(null)
    logDebug("Starting upload for", files.length, "file(s)")

    try {
      const supabase = supabaseRef.current
      const collectionGeneratingDimensions = tagDimensions.filter(
        (d) => d.generates_collection && d.dimension_key !== "file_type"
      )

      // Upload all files
      for (const file of files) {
        try {
          logDebug("Processing file:", { id: file.id, name: file.name, type: file.type, size: file.size })
          
          // Ensure we have a valid File object with type property
          if (!file || !file.type) {
            throw new Error(`File ${file?.name || 'unknown'} is missing type property`)
          }

          logDebug("Setting progress to 10%")
          setUploadProgress((prev) => ({ ...prev, [file.id]: 10 }))

          let dimensions: { width: number; height: number; duration?: number } | null = null

            logDebug("Getting dimensions for file type:", file.type)
          if (file.type.startsWith("image/")) {
            logDebug("Getting image dimensions...")
            dimensions = await getImageDimensions(file)
            logDebug("Image dimensions:", dimensions)
          } else if (file.type.startsWith("video/")) {
            logDebug("Getting video dimensions...")
            dimensions = await getVideoDimensions(file)
            logDebug("Video dimensions:", dimensions)
          }

          logDebug("Setting progress to 25%")
          setUploadProgress((prev) => ({ ...prev, [file.id]: 25 }))

          logDebug("Uploading asset to storage...")
          const uploadResult = await uploadAsset({
            clientId,
            file,
            onProgress: (progress) => {
              setUploadProgress((prev) => ({
                ...prev,
                [file.id]: 25 + (progress * 50) / 100,
              }))
            },
          })

          logDebug("Upload result:", uploadResult)
          setUploadProgress((prev) => ({ ...prev, [file.id]: 75 }))

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
              logWarn("Failed to generate video thumbnail:", error)
            }
          }

          setUploadProgress((prev) => ({ ...prev, [file.id]: 85 }))

          // Create asset
          logDebug("Creating asset in database...")
          logDebug("Asset data:", {
            client_id: clientId,
            uploaded_by: userId,
            title: titles[file.id]?.trim() || file.name || "Untitled",
            storage_bucket: "assets",
            storage_path: uploadResult.path,
            mime_type: file.type,
            file_size: file.size,
            width: dimensions?.width || null,
            height: dimensions?.height || null,
            duration_seconds: dimensions?.duration || null,
            status: "active",
          })
          
          const { data: newAsset, error: dbError } = await supabase
            .from("assets")
            .insert({
              client_id: clientId,
              uploaded_by: userId,
              title: titles[file.id]?.trim() || file.name || "Untitled",
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

          console.log("Database insert result:", { newAsset, dbError })
          
          if (dbError) {
            logError("Database error:", dbError)
            logError("Full error details:", JSON.stringify(dbError, null, 2))
            throw new Error(`Database error: ${dbError.message}`)
          }
          
          logDebug("Asset created successfully:", newAsset)

          setUploadProgress((prev) => ({ ...prev, [file.id]: 90 }))

          // Create initial asset_version
          logDebug("Creating asset version...")
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

          logDebug("Version insert result:", { versionData, versionError })
          
          if (versionError) {
            logError("Failed to create initial asset version:", versionError)
            logError("Full version error:", JSON.stringify(versionError, null, 2))
          } else {
            logDebug("Updating asset with version ID...")
            const { error: updateError } = await supabase
              .from("assets")
              .update({ current_version_id: versionData.id, previous_version_id: null })
              .eq("id", newAsset.id)
            
            if (updateError) {
              logError("Failed to update asset with version:", updateError)
            } else {
              logDebug("Asset updated with version successfully")
            }
          }

          // Collect all selected tags for this file
          const allTagIds: string[] = []
          
          if (uploadType === "bulk") {
            // In bulk mode, use bulkTags for all files
            Object.values(bulkTags).forEach((tagIds) => {
              allTagIds.push(...tagIds)
            })
          } else {
            // In single mode, use file-specific tags
            const fileTags = selectedTags[file.id] || {}
            Object.values(fileTags).forEach((tagIds) => {
              allTagIds.push(...tagIds)
            })
          }

          // Auto-assign file_type tag
          const fileTypeSlug = file.type ? getFileTypeFromMimeType(file.type) : null
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
              logError("Tag insertion error:", tagError)
            }
          }

          setUploadProgress((prev) => ({ ...prev, [file.id]: 95 }))

          await supabase.from("asset_events").insert({
            asset_id: newAsset.id,
            client_id: clientId,
            user_id: userId,
            event_type: "upload",
            source: "web",
          })

          setUploadProgress((prev) => ({ ...prev, [file.id]: 100 }))
        } catch (fileError) {
          logError(`Error uploading file ${file.name || 'file'}:`, fileError)
          const errorMessage = fileError instanceof Error ? fileError.message : `Failed to upload ${file.name || 'file'}`
          setError(errorMessage)
          // Continue with other files instead of stopping completely
          continue
        }
      }

      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        if (onSuccess) onSuccess()
      }, 1500)
    } catch (error: unknown) {
      logError("Upload error:", error)
      setError(error instanceof Error ? error.message : "An error occurred during upload")
    } finally {
      setIsLoading(false)
    }
  }

  const collectionGeneratingDimensions = tagDimensions.filter(
    (d) => d.generates_collection && d.dimension_key !== "file_type"
  )
  const descriptiveDimensions = tagDimensions.filter(
    (d) => !d.generates_collection && d.dimension_key !== "department" && d.dimension_key !== "file_type" && d.dimension_key !== "content_type"
  )

  if (isInitializing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="sr-only">Upload Asset</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: tenant.primary_color }} />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Upload Asset</DialogTitle>
          <DialogDescription className="sr-only">Upload assets to your library</DialogDescription>
        </DialogHeader>
        {/* Progress Indicator */}
        <div className="mb-8 pt-6">
          <Stepper
            steps={steps.map((s, i) => ({ label: s.label }))}
            activeStep={currentStep - 1}
            styleConfig={{
              activeBgColor: '#E55C6A',
              activeTextColor: '#ffffff',
              inactiveBgColor: '#D9D9D9',
              inactiveTextColor: '#000000',
              completedBgColor: '#E55C6A',
              completedTextColor: '#ffffff',
              size: '40px',
              circleFontSize: '14px',
              labelFontSize: '12px',
              borderRadius: '50%',
              fontWeight: '500',
            }}
            connectorStyleConfig={{
              disabledColor: '#D9D9D9',
              activeColor: '#E55C6A',
              completedColor: '#E55C6A',
              size: 1,
              stepSize: '40px',
              style: 'solid',
            }}
          />
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 1: Upload Type & File Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload</h3>
                
                {/* Upload Type Toggle */}
                <div className="mb-6 flex justify-center">
                  <div className="inline-flex rounded-full overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadType("bulk")
                        // Clear single tags when switching to bulk
                        setSelectedTags({})
                      }}
                      className={`w-24 py-2.5 text-sm font-medium transition-colors ${
                        uploadType === "bulk"
                          ? "bg-[#E55C6A] text-white"
                          : "bg-[#D9D9D9] text-gray-900"
                      }`}
                    >
                      Bulk
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadType("single")
                        // Keep only first file when switching to single
                        if (files.length > 1) {
                          setFiles(files.slice(0, 1))
                        }
                        // Clear bulk tags when switching to single
                        setBulkTags({})
                      }}
                      className={`w-24 py-2.5 text-sm font-medium transition-colors ${
                        uploadType === "single"
                          ? "bg-[#E55C6A] text-white"
                          : "bg-[#D9D9D9] text-gray-900"
                      }`}
                    >
                      Single
                    </button>
                  </div>
                </div>

                {/* File Upload Area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`relative rounded-xl border-2 border-dashed transition-all ${
                    files.length > 0
                      ? "border-gray-200 bg-gray-50/50"
                      : "border-gray-200 bg-gray-50/30 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <Input
                    type="file"
                    multiple={uploadType === "bulk"}
                    onChange={handleFileChange}
                    accept="image/*,video/*,application/pdf"
                    disabled={isLoading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {files.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
                        <Upload className="h-7 w-7 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Drag or click</p>
                      <p className="text-xs text-gray-500">
                        {uploadType === "bulk" ? "to upload multiple files" : "to upload a file"}
                      </p>
                    </div>
                  ) : uploadType === "single" ? (
                    <div className="p-6">
                      {files[0]?.preview ? (
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4 max-w-xs mx-auto">
                          <img
                            src={files[0].preview}
                            alt="Preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square rounded-lg bg-gray-100 mb-4 max-w-xs mx-auto flex items-center justify-center">
                          <FileText className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-900 truncate">{files[0]?.name}</p>
                        {files[0]?.size && (
                          <p className="text-xs text-gray-500 mt-1">
                            {(files[0].size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="mb-4 text-center">
                        <p className="text-sm font-medium text-gray-900">
                          {files.length} file{files.length !== 1 ? "s" : ""} selected
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          You can add more files or remove existing ones
                        </p>
                      </div>
                      <div className="space-y-2">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {file.preview ? (
                                <img
                                  src={file.preview}
                                  alt={file.name}
                                  className="w-12 h-12 rounded object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                                  <FileText className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                {file.size && (
                                  <p className="text-xs text-gray-500">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className="ml-4 p-1 hover:bg-gray-100 rounded"
                            >
                              <X className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Basic Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Upload asset</h3>
              
              {uploadType === "single" && files.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`title-${files[0].id}`} className="block text-sm font-medium text-gray-700 mb-2">
                      Title <span className="text-gray-400 text-xs">(optional)</span>
                    </Label>
                    <Input
                      id={`title-${files[0].id}`}
                      value={titles[files[0].id] || ""}
                      onChange={(e) =>
                        setTitles((prev) => ({ ...prev, [files[0].id]: e.target.value }))
                      }
                      placeholder="Enter asset title (leave empty to use filename)"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">Assets added list:</p>
                  {files.map((file) => (
                    <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-4 mb-4">
                        {file.preview ? (
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="w-16 h-16 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center">
                            <FileText className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          {file.size && (
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor={`title-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                            Title <span className="text-gray-400 text-xs">(optional)</span>
                          </Label>
                          <Input
                            id={`title-${file.id}`}
                            value={titles[file.id] || ""}
                            onChange={(e) =>
                              setTitles((prev) => ({ ...prev, [file.id]: e.target.value }))
                            }
                            placeholder="Enter asset title (leave empty to use filename)"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Tagging */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Tagging</h3>
              
              {uploadType === "single" && files.length > 0 ? (
                <div className="space-y-6">
                  {/* Organization Tags */}
                  {collectionGeneratingDimensions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                        Organization
                        <span className="ml-2 text-red-500 normal-case">*</span>
                      </h4>
                      <div className="space-y-4">
                        {collectionGeneratingDimensions.map((dimension) => (
                          <TagBadgeSelector
                            key={dimension.dimension_key}
                            dimension={dimension}
                            selectedTagIds={getSelectedTags(files[0].id, dimension.dimension_key)}
                            onSelect={() => {}} // Not used for multi-select, but required by component
                            onToggle={(tagId) => toggleTag(files[0].id, dimension.dimension_key, tagId)}
                            onCreate={getCreateTagHandler(dimension, files[0].id)}
                            clientId={clientId!}
                            userId={userId}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descriptive Tags */}
                  {descriptiveDimensions.length > 0 && (
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                        Additional Tags
                      </h4>
                      <Accordion type="single" collapsible className="w-full">
                        {descriptiveDimensions.map((dimension) => (
                          <AccordionItem key={dimension.dimension_key} value={dimension.dimension_key} className="border-gray-200">
                            <AccordionTrigger className="text-sm font-medium text-gray-700 hover:no-underline py-3">
                              {dimension.label}
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4">
                              <TagBadgeSelector
                                dimension={dimension}
                                selectedTagIds={getSelectedTags(files[0].id, dimension.dimension_key)}
                                onSelect={() => {}} // Not used for multi-select, but required by component
                                onToggle={(tagId) => toggleTag(files[0].id, dimension.dimension_key, tagId)}
                                onCreate={getCreateTagHandler(dimension, files[0].id)}
                                clientId={clientId!}
                                userId={userId}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Show files list */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Applying tags to {files.length} file{files.length !== 1 ? "s" : ""}:
                    </p>
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          {file.preview ? (
                            <img
                              src={file.preview}
                              alt={file.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <p className="text-sm text-gray-700 flex-1">{titles[file.id] || file.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Organization Tags */}
                  {collectionGeneratingDimensions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                        Organization
                        <span className="ml-2 text-red-500 normal-case">*</span>
                      </h4>
                      <div className="space-y-4">
                        {collectionGeneratingDimensions.map((dimension) => (
                          <TagBadgeSelector
                            key={dimension.dimension_key}
                            dimension={dimension}
                            selectedTagIds={getSelectedTags("", dimension.dimension_key)}
                            onSelect={() => {}} // Not used for multi-select, but required by component
                            onToggle={(tagId) => toggleTag("", dimension.dimension_key, tagId)}
                            onCreate={getCreateTagHandler(dimension)}
                            clientId={clientId!}
                            userId={userId}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descriptive Tags */}
                  {descriptiveDimensions.length > 0 && (
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                        Additional Tags
                      </h4>
                      <Accordion type="single" collapsible className="w-full">
                        {descriptiveDimensions.map((dimension) => (
                          <AccordionItem key={dimension.dimension_key} value={dimension.dimension_key} className="border-gray-200">
                            <AccordionTrigger className="text-sm font-medium text-gray-700 hover:no-underline py-3">
                              {dimension.label}
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4">
                              <TagBadgeSelector
                                dimension={dimension}
                                selectedTagIds={getSelectedTags("", dimension.dimension_key)}
                                onSelect={() => {}} // Not used for multi-select, but required by component
                                onToggle={(tagId) => toggleTag("", dimension.dimension_key, tagId)}
                                onCreate={getCreateTagHandler(dimension)}
                                clientId={clientId!}
                                userId={userId}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800 border border-green-200">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm font-medium">Upload successful!</p>
          </div>
        )}

        {/* Upload Progress */}
        {isLoading && Object.keys(uploadProgress).length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file) => (
              <div key={file.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{file.name}</span>
                  <span className="text-gray-600">{uploadProgress[file.id] || 0}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full transition-all duration-300 bg-blue-600"
                    style={{ width: `${uploadProgress[file.id] || 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center items-center gap-3 mt-6 pt-6 border-t border-gray-200">
          {currentStep > 1 && (
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handlePrevious} 
              disabled={isLoading}
              className="rounded-[25px] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
          )}
          {currentStep < steps.length ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isLoading}
              className="rounded-[25px] flex items-center justify-center gap-2 px-8"
              style={{
                backgroundColor: tenant.primary_color,
                borderColor: tenant.primary_color,
              }}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || success}
              className="rounded-[25px] flex items-center justify-center gap-2 px-8"
              style={{
                backgroundColor: tenant.primary_color,
                borderColor: tenant.primary_color,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload asset
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

