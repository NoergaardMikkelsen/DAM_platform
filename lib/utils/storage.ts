import { createClient } from "@/lib/supabase/client"

export interface UploadOptions {
  clientId: string
  file: File
  onProgress?: (progress: number) => void
}

export interface UploadResult {
  path: string
  fullPath: string
  publicUrl: string | null
}

/**
 * Upload a file to Supabase Storage in the client's folder
 */
export async function uploadAsset({ clientId, file, onProgress }: UploadOptions): Promise<UploadResult> {
  const supabase = createClient()

  // Generate unique filename
  const fileExt = file.name?.split(".").pop() || "bin"
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  const fileName = `${timestamp}-${random}.${fileExt}`

  // Path format: {clientId}/{fileName}
  const filePath = `${clientId}/${fileName}`

  // Upload file
  const { data, error } = await supabase.storage.from("assets").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  onProgress?.(100)

  // Get public URL (even though bucket is private, this gives us the path)
  const {
    data: { publicUrl },
  } = supabase.storage.from("assets").getPublicUrl(filePath)

  return {
    path: data.path || filePath, // Use data.path if available, fallback to filePath
    fullPath: filePath,
    publicUrl: publicUrl || null,
  }
}

/**
 * Get a signed URL for a private asset
 */
export async function getAssetUrl(path: string, expiresIn = 3600): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase.storage.from("assets").createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Failed to get asset URL: ${error.message}`)
  }

  return data.signedUrl
}

/**
 * Delete an asset from storage
 */
export async function deleteAsset(path: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.storage.from("assets").remove([path])

  if (error) {
    throw new Error(`Failed to delete asset: ${error.message}`)
  }
}

/**
 * Get image dimensions from a file
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type?.startsWith("image/")) {
    return null
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Get video duration and dimensions from a file
 */
export async function getVideoDimensions(
  file: File,
): Promise<{ width: number; height: number; duration: number } | null> {
  if (!file.type?.startsWith("video/")) {
    return null
  }

  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Math.round(video.duration),
      })
      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(file)
  })
}

/**
 * Generate a thumbnail image from a video file
 */
export async function generateVideoThumbnail(file: File): Promise<File | null> {
  if (!file.type?.startsWith("video/")) {
    return null
  }

  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.currentTime = 1 // Seek to 1 second to get a frame

    video.onloadedmetadata = () => {
      // Create canvas to capture video frame
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        resolve(null)
        return
      }

      // Set canvas size to video dimensions (but limit max size)
      const maxDimension = 300
      const aspectRatio = video.videoWidth / video.videoHeight

      if (video.videoWidth > video.videoHeight) {
        canvas.width = Math.min(video.videoWidth, maxDimension)
        canvas.height = canvas.width / aspectRatio
      } else {
        canvas.height = Math.min(video.videoHeight, maxDimension)
        canvas.width = canvas.height * aspectRatio
      }

      video.onseeked = () => {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            // Create File from blob
            const baseName = file.name?.split('.')[0] || 'thumbnail'
            const thumbnailFile = new File([blob], `${baseName}_thumbnail.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
            resolve(thumbnailFile)
          } else {
            resolve(null)
          }
          URL.revokeObjectURL(video.src)
        }, "image/jpeg", 0.8)
      }

      video.onerror = () => {
        resolve(null)
        URL.revokeObjectURL(video.src)
      }
    }

    video.src = URL.createObjectURL(file)
  })
}
