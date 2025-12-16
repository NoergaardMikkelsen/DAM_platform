import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get all video assets without thumbnails
    const { data: videoAssets, error } = await supabase
      .from("assets")
      .select(`
        id,
        storage_path,
        mime_type,
        asset_versions!current_version_id (
          id,
          thumbnail_path
        )
      `)
      .eq("mime_type", "video/mp4")
      .is("asset_versions.thumbnail_path", null)

    if (error) {
      console.error("Error fetching video assets:", error)
      return NextResponse.json({ error: "Failed to fetch video assets" }, { status: 500 })
    }

    console.log(`Found ${videoAssets?.length || 0} video assets without thumbnails`)

    if (!videoAssets || videoAssets.length === 0) {
      return NextResponse.json({ message: "No video assets need thumbnails" })
    }

    const results = []

    for (const asset of videoAssets) {
      try {
        console.log(`Processing video asset: ${asset.id}`)

        // Download the video file
        const { data: videoBlob, error: downloadError } = await supabase.storage
          .from("assets")
          .download(asset.storage_path)

        if (downloadError) {
          console.error(`Failed to download video ${asset.id}:`, downloadError)
          results.push({ id: asset.id, status: "download_failed", error: downloadError.message })
          continue
        }

        // For now, we'll just mark these assets as needing manual thumbnail generation
        // since we can't run the video processing in a server environment easily
        results.push({
          id: asset.id,
          status: "needs_manual_generation",
          message: "Video thumbnail generation needs to be done client-side"
        })

      } catch (error) {
        console.error(`Error processing video ${asset.id}:`, error)
        results.push({ id: asset.id, status: "error", error: (error as Error).message })
      }
    }

    return NextResponse.json({
      message: "Thumbnail regeneration analysis complete",
      totalAssets: videoAssets.length,
      results
    })

  } catch (error) {
    console.error("Error in regenerate thumbnails:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
