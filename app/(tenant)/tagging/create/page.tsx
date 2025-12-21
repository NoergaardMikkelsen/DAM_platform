"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useTenant } from "@/lib/context/tenant-context"

export default function CreateTagPage() {
  const { tenant } = useTenant()
  const [label, setLabel] = useState("")
  const [tagType, setTagType] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Create slug from label
      const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

      const { error: insertError } = await supabase.from("tags").insert({
        client_id: tenant.id,
        created_by: user.id,
        tag_type: tagType,
        label,
        slug,
        is_system: false,
      })

      if (insertError) throw insertError

      router.push("/tagging")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/tagging" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to tagging
        </Link>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create new tag</CardTitle>
          <CardDescription>Add a new tag to organize your assets</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="label">Tag label *</Label>
              <Input
                id="label"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Campaign, Employee, Product"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagType">Tag type *</Label>
              <Select value={tagType} onValueChange={setTagType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select tag type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                  <SelectItem value="usage">Usage</SelectItem>
                  <SelectItem value="visual_style">Visual Style</SelectItem>
                  <SelectItem value="file_type">File Type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-4">
              <Link href="/tagging">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="rounded-[25px]" style={{ backgroundColor: tenant.primary_color }} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create tag"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
