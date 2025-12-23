export type Role = {
  id: string
  key: "superadmin" | "admin" | "user"
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Client = {
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
}

export type User = {
  id: string
  full_name: string
  email: string
  phone: string | null
  department: string | null
  current_position: string | null
  created_at: string
  updated_at: string
}

export type ClientUser = {
  id: string
  client_id: string
  user_id: string
  role_id: string
  status: string
  created_at: string
  updated_at: string
}

export type TagDimension = {
  id: string
  dimension_key: string
  label: string
  is_hierarchical: boolean
  requires_subtag: boolean
  allows_multiple: boolean
  required: boolean
  display_order: number
  generates_collection: boolean
  allow_user_creation: boolean
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  client_id: string
  created_by: string | null
  dimension_key: string | null // New: references tag_dimensions
  parent_id: string | null // New: for hierarchical tags
  tag_type?: string // Legacy field, kept for backward compatibility
  label: string
  slug: string
  is_system: boolean
  sort_order: number
  created_at: string
  updated_at: string
  asset_count?: number // Computed field for UI
}

export type Asset = {
  id: string
  client_id: string
  uploaded_by: string | null
  title: string
  description: string | null
  storage_bucket: string
  storage_path: string
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  category_tag_id?: string | null // Legacy field, removed in migration
  status: string
  current_version_id?: string | null
  previous_version_id?: string | null
  created_at: string
  updated_at: string
}

export type AssetEvent = {
  id: string
  asset_id: string
  client_id: string
  user_id: string | null
  event_type: "upload" | "download" | "update" | "delete" | "view" | "replace" | "restore"
  source: string | null
  client_ip: string | null
  created_at: string
}

export type Favorite = {
  id: string
  user_id: string
  asset_id: string
  created_at: string
}

export type SystemSetting = {
  id: string
  key: string
  value: string
  description: string | null
  created_at: string
  updated_at: string
}

export type UserWithRole = User & {
  role: string
  client_id: string
}
