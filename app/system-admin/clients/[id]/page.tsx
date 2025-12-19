"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Building, Users, Database, Settings, Trash2 } from "lucide-react"
import Link from "next/link"
import React, { useState, useEffect, useRef, use } from "react"
import { useRouter, useParams } from "next/navigation"

interface Client {
  id: string
  name: string
  slug: string
  domain: string | null
  logo_url: string | null
  status: string
  primary_color: string
  secondary_color: string
  storage_limit_mb: number
  created_at: string
  updated_at: string
  user_count?: number
  asset_count?: number
  storage_used_bytes?: number
}

export default function ClientDetailPage() {
  const paramsPromise = useParams()
  const [id, setId] = useState<string>("")
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    domain: "",
    logo_url: "",
    primary_color: "",
    secondary_color: "",
    storage_limit_mb: 0
  })
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  // Unwrap the params promise
  useEffect(() => {
    const unwrapParams = async () => {
      const resolvedParams = await paramsPromise
      setId(resolvedParams.id as string)
    }
    unwrapParams()
  }, [paramsPromise])

  useEffect(() => {
    if (!id) return
    loadClient()
  }, [id])

  const loadClient = async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    // Check if user is admin or superadmin
    const { data: userRole } = await supabase
      .from("client_users")
      .select(`roles(key)`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    const role = userRole?.roles?.key
    if (role !== "admin" && role !== "superadmin") {
      router.push("/dashboard")
      return
    }

    // Get client details
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single()

    if (!clientData) {
      router.push("/system-admin/clients")
      return
    }

    // Get client stats
    const { count: userCount } = await supabase
      .from("client_users")
      .select("*", { count: "exact", head: true })
      .eq("client_id", id)

    const { count: assetCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", id)

    const { data: assets } = await supabase
      .from("assets")
      .select("file_size")
      .eq("client_id", id)

    const storageUsedBytes =
      (assets ?? []).reduce((sum: number, asset: { file_size: number | null }) => sum + (asset.file_size || 0), 0) ||
      0

    setClient({
      ...clientData,
      user_count: userCount || 0,
      asset_count: assetCount || 0,
      storage_used_bytes: storageUsedBytes
    })

    setEditForm({
      name: clientData.name,
      slug: clientData.slug,
      domain: clientData.domain || "",
      logo_url: clientData.logo_url || "",
      primary_color: clientData.primary_color,
      secondary_color: clientData.secondary_color,
      storage_limit_mb: clientData.storage_limit_mb
    })

    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!client) return

    const supabase = supabaseRef.current
    setIsLoading(true)

    const { error } = await supabase
      .from("clients")
      .update({
        name: editForm.name,
        slug: editForm.slug,
        domain: editForm.domain || null,
        primary_color: editForm.primary_color,
        secondary_color: editForm.secondary_color,
        storage_limit_mb: editForm.storage_limit_mb
      })
      .eq("id", client.id)

    if (error) {
      console.error("Error updating client:", error)
      // TODO: Show error toast
    } else {
      setIsEditing(false)
      await loadClient() // Reload data
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!client) return

    // TODO: Implement delete confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete client "${client.name}"? This action cannot be undone.`)

    if (!confirmed) return

    const supabase = supabaseRef.current
    setIsLoading(true)

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id)

    if (error) {
      console.error("Error deleting client:", error)
      // TODO: Show error toast
    } else {
      router.push("/system-admin/clients")
    }

    setIsLoading(false)
  }

  if (!client) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-600">Client not found</p>
          <Link href="/system-admin/clients">
            <Button className="mt-4">Back to Clients</Button>
          </Link>
        </div>
      </div>
    )
  }

  const storageUsedGB = ((client.storage_used_bytes || 0) / 1024 / 1024 / 1024).toFixed(2)
  const storageLimitGB = (client.storage_limit_mb / 1024).toFixed(2)
  const storagePercentage = Math.min(((client.storage_used_bytes || 0) / (client.storage_limit_mb * 1024 * 1024)) * 100, 100)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/system-admin/clients" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-600"
            >
              <Building className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center gap-4">
              {client.logo_url && (
                <img
                  src={client.logo_url}
                  alt={`${client.name} logo`}
                  className="w-12 h-12 object-contain rounded-lg border"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
                <p className="text-gray-500">{client.slug}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={client.status === "active" ? "default" : "secondary"}
              className={client.status === "active" ? "bg-green-100 text-green-800" : ""}
            >
              {client.status}
            </Badge>
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={isLoading}>
                  Save Changes
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleDelete} disabled={isLoading}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Basic client details and configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Name</Label>
                  <p className="text-gray-900">{client.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Slug</Label>
                  <p className="text-gray-900">{client.slug}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Domain</Label>
                  <p className="text-gray-900">{client.domain || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: client.primary_color }}
                    />
                    <span className="text-gray-900">{client.primary_color}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: client.secondary_color }}
                    />
                    <span className="text-gray-900">{client.secondary_color}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Storage Limit</Label>
                  <p className="text-gray-900">{client.storage_limit_mb} MB ({storageLimitGB} GB)</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={editForm.slug}
                    onChange={(e) => setEditForm(prev => ({ ...prev, slug: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={editForm.domain}
                    onChange={(e) => setEditForm(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="client-domain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <Input
                    id="primary_color"
                    type="color"
                    value={editForm.primary_color}
                    onChange={(e) => setEditForm(prev => ({ ...prev, primary_color: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <Input
                    id="secondary_color"
                    type="color"
                    value={editForm.secondary_color}
                    onChange={(e) => setEditForm(prev => ({ ...prev, secondary_color: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_limit">Storage Limit (MB)</Label>
                  <Input
                    id="storage_limit"
                    type="number"
                    value={editForm.storage_limit_mb}
                    onChange={(e) => setEditForm(prev => ({ ...prev, storage_limit_mb: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="space-y-6">
          {/* Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{client.user_count}</div>
              <p className="text-sm text-gray-600">Active users in this client</p>
            </CardContent>
          </Card>

          {/* Assets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{client.asset_count}</div>
              <p className="text-sm text-gray-600">Total assets uploaded</p>
            </CardContent>
          </Card>

          {/* Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Storage Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{storagePercentage.toFixed(1)}%</div>
              <div className="mt-2 text-sm text-gray-600">
                {storageUsedGB} GB used of {storageLimitGB} GB
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
