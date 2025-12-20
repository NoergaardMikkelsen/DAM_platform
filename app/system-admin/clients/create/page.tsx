"use client"

import React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function CreateClientPage() {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#000000")
  const [secondaryColor, setSecondaryColor] = useState("#6c757d")
  const [storageLimit, setStorageLimit] = useState("10000")
  const [status, setStatus] = useState("active")
  const [generatedDomain, setGeneratedDomain] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Determine the base domain for tenant URLs
  const getTenantBaseDomain = () => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost')
      if (isLocalhost) {
        return 'localhost'
      }
    }
    return 'brandassets.space'
  }

  // Generate slug and domain preview when name changes
  const handleNameChange = (value: string) => {
    setName(value)
    if (value.trim()) {
      const generatedSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      setSlug(generatedSlug)
      setGeneratedDomain(`${generatedSlug}.${getTenantBaseDomain()}`)
    } else {
      setSlug("")
      setGeneratedDomain("")
    }
  }

  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError("Please select an image file")
        return
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo file size must be less than 5MB")
        return
      }

      setLogoFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  // Remove logo
  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  // Handle favicon file selection
  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type - only PNG and SVG supported for favicons
      if (!file.type.startsWith('image/') || file.type.includes('icon')) {
        setError("Please select a PNG or SVG file for favicon. ICO files are not supported by our storage system.")
        return
      }

      // Reject ICO files explicitly
      if (file.name.toLowerCase().endsWith('.ico')) {
        setError("ICO files are not supported. Please convert your favicon to PNG format using an online converter.")
        return
      }

      // Validate file size (2MB limit for favicons)
      if (file.size > 2 * 1024 * 1024) {
        setError("Favicon file size must be less than 2MB")
        return
      }

      setFaviconFile(file)

      // Create preview for image files
      const reader = new FileReader()
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  // Remove favicon
  const removeFavicon = () => {
    setFaviconFile(null)
    setFaviconPreview(null)
  }

  // Update domain when slug changes
  const handleSlugChange = async (value: string) => {
    const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-|-$/g, "")
    setSlug(cleanSlug)

    if (cleanSlug) {
      setGeneratedDomain(`${cleanSlug}.${getTenantBaseDomain()}`)

      // Check if slug is available
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("clients")
          .select("id")
          .eq("slug", cleanSlug)
          .limit(1)

        if (data && data.length > 0) {
          setSlugError("This subdomain is already taken")
        } else {
          setSlugError(null)
        }
      } catch (error) {
        setSlugError("Unable to check subdomain availability")
      }
    } else {
      setGeneratedDomain("")
      setSlugError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate slug
    if (!slug.trim()) {
      setError("Subdomain is required")
      return
    }

    if (slugError) {
      setError("Please choose a different subdomain")
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      let logoUrl = null
      let faviconUrl = null

      // Upload logo if selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${slug}-logo-${Date.now()}.${fileExt}`
        const filePath = `client-logos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath)

        logoUrl = publicUrl
      }

      // Upload favicon if selected (PNG/SVG only)
      if (faviconFile) {
        const fileExt = faviconFile.name.split('.').pop()
        const fileName = `${slug}-favicon-${Date.now()}.${fileExt}`
        const filePath = `client-favicons/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, faviconFile)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath)

        faviconUrl = publicUrl
      }

      // Ensure colors have # prefix
      const finalPrimaryColor = primaryColor.startsWith('#') ? primaryColor : '#' + primaryColor
      const finalSecondaryColor = secondaryColor.startsWith('#') ? secondaryColor : '#' + secondaryColor

      // Insert client
      const { data: clientData, error: insertError } = await supabase.from("clients").insert({
        name,
        slug,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        status,
        primary_color: finalPrimaryColor,
        secondary_color: finalSecondaryColor,
        storage_limit_mb: Number.parseInt(storageLimit),
      }).select().single()

      if (insertError) throw insertError

      // Create client_users relation for superadmin
      const { data: { user } } = await supabase.auth.getUser()
      if (user && clientData) {
        const { error: userRelationError } = await supabase.from("client_users").insert({
          client_id: clientData.id,
          user_id: user.id,
          role_id: '73e573da-7906-4027-bdaa-a89d70dd8550', // superadmin role
          status: "active"
        })

        if (userRelationError) {
          console.error("Failed to create client-user relation:", userRelationError)
          // Don't throw error - client is created, just log the relation issue
        }
      }

      router.push("/system-admin/clients")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/system-admin/clients" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to clients
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Client</h1>
        <p className="text-gray-600 mt-1">Add a new client to the platform</p>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Client Information</CardTitle>
          <CardDescription>Configure the basic settings for this client</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Client name *</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., NMIC, Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Client Logo</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="flex-1 cursor-pointer file:cursor-pointer"
                />
                {logoPreview && (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 object-contain border rounded"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Upload a logo for this client (max 5MB, image files only)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="favicon">Client Favicon</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="favicon"
                  type="file"
                  accept="image/png,image/svg+xml"
                  onChange={handleFaviconChange}
                  className="flex-1 cursor-pointer file:cursor-pointer"
                />
                {faviconPreview && (
                  <div className="relative">
                    <img
                      src={faviconPreview}
                      alt="Favicon preview"
                      className="w-8 h-8 object-contain border rounded"
                    />
                    <button
                      type="button"
                      onClick={removeFavicon}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Upload a favicon for this client (max 2MB, PNG/SVG files only)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Subdomain *</Label>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g., nmic, my-company"
                className={slugError ? "border-red-500" : ""}
              />
              {slugError && <p className="text-xs text-red-500">{slugError}</p>}
              <p className="text-xs text-gray-500">Choose your preferred subdomain (letters, numbers, and hyphens only)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Full Domain</Label>
              <Input
                id="domain"
                value={generatedDomain}
                readOnly
                className="bg-gray-50"
                placeholder="Choose a subdomain above"
              />
              <p className="text-xs text-gray-500">Your subdomain will be created on the platform domain</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary color *</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    required
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-20"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => {
                      let value = e.target.value
                      // Auto-add # if not present and value looks like a color
                      if (value && !value.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(value)) {
                        value = '#' + value
                      }
                      setPrimaryColor(value)
                    }}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary color *</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    required
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-20"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => {
                      let value = e.target.value
                      // Auto-add # if not present and value looks like a color
                      if (value && !value.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(value)) {
                        value = '#' + value
                      }
                      setSecondaryColor(value)
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="storageLimit">Storage limit (MB) *</Label>
                <Input
                  id="storageLimit"
                  type="number"
                  required
                  value={storageLimit}
                  onChange={(e) => setStorageLimit(e.target.value)}
                  placeholder="10000"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={setStatus} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-4">
              <Link href="/system-admin/clients">
                <Button type="button" variant="outline" disabled={isLoading} className="cursor-pointer">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="bg-black hover:bg-gray-800 text-white rounded-[25px]" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create client"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
