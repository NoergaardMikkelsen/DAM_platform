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

export type Tag = {
  id: string
  client_id: string
  created_by: string | null
  tag_type: "category" | "description" | "usage" | "visual_style" | "file_type"
  label: string
  slug: string
  is_system: boolean
  sort_order: number
  created_at: string
  updated_at: string
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
  category_tag_id: string | null
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

export type UserWithRole = User & {
  role: string
  client_id: string
}
