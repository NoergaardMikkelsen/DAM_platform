-- ============================================================================
-- Update RLS Policies Based on Permission Matrix
-- ============================================================================
-- This script updates all RLS policies to match the permission matrix:
-- - Superadmin: Full access everywhere
-- - Admin: Full access for their clients
-- - User: Limited access (view/download/upload, but no delete/edit/versioning)
-- ============================================================================

-- First, ensure helper functions are up to date
-- ============================================================================

-- Helper function to check if user is superadmin (using system_admins table)
-- Note: This assumes system_admins table exists (created in 060_create_system_admins_table.sql)
CREATE OR REPLACE FUNCTION is_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM system_admins
    WHERE id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has access to a client
CREATE OR REPLACE FUNCTION has_client_access(p_user_id UUID, p_client_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmins have access to all clients
  IF is_superadmin(p_user_id) THEN
    RETURN true;
  END IF;
  
  -- Check if user has active membership in the client
  RETURN EXISTS (
    SELECT 1
    FROM client_users cu
    WHERE cu.user_id = p_user_id
      AND cu.client_id = p_client_id
      AND cu.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role key for a specific client
CREATE OR REPLACE FUNCTION get_user_role_key(p_user_id UUID, p_client_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Superadmins are treated as superadmin for all clients
  IF is_superadmin(p_user_id) THEN
    RETURN 'superadmin';
  END IF;
  
  RETURN (
    SELECT r.key
    FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = p_user_id
      AND cu.client_id = p_client_id
      AND cu.status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin or superadmin for a client
CREATE OR REPLACE FUNCTION is_admin_or_superadmin(p_user_id UUID, p_client_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_superadmin(p_user_id) OR get_user_role_key(p_user_id, p_client_id) IN ('admin', 'superadmin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if asset was uploaded by user
CREATE OR REPLACE FUNCTION is_asset_uploader(p_user_id UUID, p_asset_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM assets a
    WHERE a.id = p_asset_id
      AND a.created_by = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Drop existing policies (will be recreated below)
-- ============================================================================

-- Assets policies
DROP POLICY IF EXISTS "assets_select" ON assets;
DROP POLICY IF EXISTS "assets_insert" ON assets;
DROP POLICY IF EXISTS "assets_update" ON assets;
DROP POLICY IF EXISTS "assets_delete" ON assets;

-- Asset versions policies
DROP POLICY IF EXISTS "asset_versions_select" ON asset_versions;
DROP POLICY IF EXISTS "asset_versions_insert" ON asset_versions;
DROP POLICY IF EXISTS "asset_versions_update" ON asset_versions;
DROP POLICY IF EXISTS "asset_versions_delete" ON asset_versions;

-- Tags policies
DROP POLICY IF EXISTS "tags_select" ON tags;
DROP POLICY IF EXISTS "tags_insert" ON tags;
DROP POLICY IF EXISTS "tags_update" ON tags;
DROP POLICY IF EXISTS "tags_delete" ON tags;

-- Asset tags policies
DROP POLICY IF EXISTS "asset_tags_select" ON asset_tags;
DROP POLICY IF EXISTS "asset_tags_insert" ON asset_tags;
DROP POLICY IF EXISTS "asset_tags_update" ON asset_tags;
DROP POLICY IF EXISTS "asset_tags_delete" ON asset_tags;

-- Users policies
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- Client users policies
DROP POLICY IF EXISTS "client_users_select" ON client_users;
DROP POLICY IF EXISTS "client_users_insert" ON client_users;
DROP POLICY IF EXISTS "client_users_update" ON client_users;
DROP POLICY IF EXISTS "client_users_delete" ON client_users;

-- Clients policies
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;

-- Asset events policies
DROP POLICY IF EXISTS "asset_events_select" ON asset_events;
DROP POLICY IF EXISTS "asset_events_insert" ON asset_events;

-- Favorites policies
DROP POLICY IF EXISTS "favorites_select" ON favorites;
DROP POLICY IF EXISTS "favorites_insert" ON favorites;
DROP POLICY IF EXISTS "favorites_delete" ON favorites;

-- Saved filters policies
DROP POLICY IF EXISTS "saved_filters_select" ON saved_filters;
DROP POLICY IF EXISTS "saved_filters_insert" ON saved_filters;
DROP POLICY IF EXISTS "saved_filters_update" ON saved_filters;
DROP POLICY IF EXISTS "saved_filters_delete" ON saved_filters;

-- Tag dimensions policies
DROP POLICY IF EXISTS "tag_dimensions_select" ON tag_dimensions;
DROP POLICY IF EXISTS "tag_dimensions_insert" ON tag_dimensions;
DROP POLICY IF EXISTS "tag_dimensions_update" ON tag_dimensions;
DROP POLICY IF EXISTS "tag_dimensions_delete" ON tag_dimensions;

-- ============================================================================
-- ASSETS POLICIES
-- ============================================================================
-- Viewing: All roles can view client assets
-- Downloading: All roles can download client assets (handled by storage policies)
-- Uploading: All roles can upload assets for clients
-- Deletion: Only admin/superadmin can delete
-- Editing: Only admin/superadmin can edit
-- Versioning: Only admin/superadmin can upload new versions (users cannot replace)

-- SELECT: All authenticated users can view assets for their clients
CREATE POLICY "assets_select" ON assets FOR SELECT TO authenticated
USING (has_client_access(auth.uid(), client_id));

-- INSERT: All authenticated users can upload assets for their clients
CREATE POLICY "assets_insert" ON assets FOR INSERT TO authenticated
WITH CHECK (has_client_access(auth.uid(), client_id));

-- UPDATE: Only admin/superadmin can edit assets
CREATE POLICY "assets_update" ON assets FOR UPDATE TO authenticated
USING (
  has_client_access(auth.uid(), client_id)
  AND is_admin_or_superadmin(auth.uid(), client_id)
);

-- DELETE: Only admin/superadmin can delete assets
CREATE POLICY "assets_delete" ON assets FOR DELETE TO authenticated
USING (
  has_client_access(auth.uid(), client_id)
  AND is_admin_or_superadmin(auth.uid(), client_id)
);

-- ============================================================================
-- ASSET VERSIONS POLICIES
-- ============================================================================
-- Only admin/superadmin can create new versions (replace files)
-- Users cannot replace files, even their own uploads

-- SELECT: All authenticated users can view versions for assets they can access
CREATE POLICY "asset_versions_select" ON asset_versions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_versions.asset_id
      AND has_client_access(auth.uid(), a.client_id)
  )
);

-- INSERT: Only admin/superadmin can create new versions (replace files)
CREATE POLICY "asset_versions_insert" ON asset_versions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_versions.asset_id
      AND has_client_access(auth.uid(), a.client_id)
      AND is_admin_or_superadmin(auth.uid(), a.client_id)
  )
);

-- UPDATE: Only admin/superadmin can update versions
CREATE POLICY "asset_versions_update" ON asset_versions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_versions.asset_id
      AND has_client_access(auth.uid(), a.client_id)
      AND is_admin_or_superadmin(auth.uid(), a.client_id)
  )
);

-- DELETE: Only admin/superadmin can delete versions
CREATE POLICY "asset_versions_delete" ON asset_versions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_versions.asset_id
      AND has_client_access(auth.uid(), a.client_id)
      AND is_admin_or_superadmin(auth.uid(), a.client_id)
  )
);

-- ============================================================================
-- TAGS POLICIES
-- ============================================================================
-- Viewing: All roles can view client tags
-- Creation: Admin/superadmin can create tags, users can only create tags on upload
-- Deletion: Only admin/superadmin can delete tags
-- Editing: Admin/superadmin can edit all tags, users can only edit tags on own uploads

-- SELECT: All authenticated users can view tags for their clients
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated
USING (
  client_id IS NULL  -- System/global tags
  OR has_client_access(auth.uid(), client_id)
);

-- INSERT: Admin/superadmin can create tags, users can create tags (handled by application logic for upload-only)
-- Note: Application should restrict user tag creation to upload context
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated
WITH CHECK (
  client_id IS NULL  -- System tags can only be created by superadmin
  OR (
    has_client_access(auth.uid(), client_id)
    AND (
      is_admin_or_superadmin(auth.uid(), client_id)
      -- Users can create tags, but application should restrict to upload context
    )
  )
);

-- UPDATE: Admin/superadmin can edit all tags, users can only edit tags on own uploads
-- Note: Application should check if tag is associated with user's own uploads
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated
USING (
  client_id IS NULL  -- System tags can only be edited by superadmin
  OR (
    has_client_access(auth.uid(), client_id)
    AND (
      is_admin_or_superadmin(auth.uid(), client_id)
      -- Users can edit tags, but application should restrict to own uploads
    )
  )
);

-- DELETE: Only admin/superadmin can delete tags
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
USING (
  is_system = false
  AND (
    client_id IS NULL  -- System tags can only be deleted by superadmin
    OR (
      has_client_access(auth.uid(), client_id)
      AND is_admin_or_superadmin(auth.uid(), client_id)
    )
  )
);

-- ============================================================================
-- ASSET_TAGS POLICIES
-- ============================================================================
-- All authenticated users can manage tags on assets they can access

-- SELECT: All authenticated users can view asset tags for assets they can access
CREATE POLICY "asset_tags_select" ON asset_tags FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_tags.asset_id
      AND has_client_access(auth.uid(), a.client_id)
  )
);

-- INSERT: All authenticated users can add tags to assets they can access
CREATE POLICY "asset_tags_insert" ON asset_tags FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_tags.asset_id
      AND has_client_access(auth.uid(), a.client_id)
  )
);

-- UPDATE: All authenticated users can update asset tags for assets they can access
CREATE POLICY "asset_tags_update" ON asset_tags FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_tags.asset_id
      AND has_client_access(auth.uid(), a.client_id)
  )
);

-- DELETE: All authenticated users can remove tags from assets they can access
CREATE POLICY "asset_tags_delete" ON asset_tags FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_tags.asset_id
      AND has_client_access(auth.uid(), a.client_id)
  )
);

-- ============================================================================
-- USERS POLICIES
-- ============================================================================
-- Viewing: All roles can view client users
-- Add/Delete/Edit: Only admin/superadmin can manage users

-- SELECT: Users can see their own profile and users in their clients
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
USING (
  id = auth.uid()  -- Users can see their own profile
  OR EXISTS (
    SELECT 1 FROM client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND EXISTS (
        SELECT 1 FROM client_users cu2
        WHERE cu2.client_id = cu.client_id
          AND cu2.user_id = users.id
          AND cu2.status = 'active'
      )
  )
  OR is_superadmin(auth.uid())  -- Superadmins can see all users
);

-- INSERT: Only superadmin can create users (handled by application)
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

-- UPDATE: Users can update their own profile, admin/superadmin can update client users
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated
USING (
  id = auth.uid()  -- Users can update their own profile
  OR EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key IN ('admin', 'superadmin')
      AND EXISTS (
        SELECT 1 FROM client_users cu2
        WHERE cu2.client_id = cu.client_id
          AND cu2.user_id = users.id
          AND cu2.status = 'active'
      )
  )
  OR is_superadmin(auth.uid())  -- Superadmins can update all users
);

-- DELETE: Only superadmin can delete users
CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated
USING (is_superadmin(auth.uid()));

-- ============================================================================
-- CLIENT_USERS POLICIES
-- ============================================================================
-- Viewing: All roles can view client users
-- Add/Delete/Edit: Only admin/superadmin can manage client users

-- SELECT: Users can see their own memberships and users in their clients
CREATE POLICY "client_users_select" ON client_users FOR SELECT TO authenticated
USING (
  user_id = auth.uid()  -- Users can see their own memberships
  OR EXISTS (
    SELECT 1 FROM client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.client_id = client_users.client_id
      AND cu.status = 'active'
  )
  OR is_superadmin(auth.uid())  -- Superadmins can see all memberships
);

-- INSERT: Only admin/superadmin can add users to clients
CREATE POLICY "client_users_insert" ON client_users FOR INSERT TO authenticated
WITH CHECK (
  is_superadmin(auth.uid())
  OR is_admin_or_superadmin(auth.uid(), client_id)
);

-- UPDATE: Only admin/superadmin can update client user memberships
CREATE POLICY "client_users_update" ON client_users FOR UPDATE TO authenticated
USING (
  is_superadmin(auth.uid())
  OR is_admin_or_superadmin(auth.uid(), client_id)
);

-- DELETE: Only admin/superadmin can remove users from clients
CREATE POLICY "client_users_delete" ON client_users FOR DELETE TO authenticated
USING (
  is_superadmin(auth.uid())
  OR is_admin_or_superadmin(auth.uid(), client_id)
);

-- ============================================================================
-- CLIENTS POLICIES
-- ============================================================================
-- Creation: Only superadmin can create clients
-- Update: Only superadmin can update clients (admin cannot update clients)
-- Viewing: Users can see their own clients, superadmins can see all

-- SELECT: Users can see their own clients, superadmins can see all
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated
USING (
  has_client_access(auth.uid(), id)
  OR is_superadmin(auth.uid())
);

-- INSERT: Only superadmin can create clients
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

-- UPDATE: Only superadmin can update clients
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated
USING (is_superadmin(auth.uid()));

-- DELETE: Only superadmin can delete clients
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated
USING (is_superadmin(auth.uid()));

-- ============================================================================
-- ASSET_EVENTS POLICIES
-- ============================================================================
-- All authenticated users can view and create events for their client's assets

-- SELECT: All authenticated users can view events for their client's assets
CREATE POLICY "asset_events_select" ON asset_events FOR SELECT TO authenticated
USING (has_client_access(auth.uid(), client_id));

-- INSERT: All authenticated users can create events for their client's assets
CREATE POLICY "asset_events_insert" ON asset_events FOR INSERT TO authenticated
WITH CHECK (has_client_access(auth.uid(), client_id));

-- ============================================================================
-- FAVORITES POLICIES
-- ============================================================================
-- Users can manage their own favorites

-- SELECT: Users can see their own favorites
CREATE POLICY "favorites_select" ON favorites FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can create their own favorites
CREATE POLICY "favorites_insert" ON favorites FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own favorites
CREATE POLICY "favorites_delete" ON favorites FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- SAVED_FILTERS POLICIES
-- ============================================================================
-- Users can manage their own filters and see public ones

-- SELECT: Users can see their own filters and public filters
CREATE POLICY "saved_filters_select" ON saved_filters FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_public = true
  OR has_client_access(auth.uid(), client_id)
);

-- INSERT: Users can create filters for their clients
CREATE POLICY "saved_filters_insert" ON saved_filters FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND has_client_access(auth.uid(), client_id)
);

-- UPDATE: Users can update their own filters
CREATE POLICY "saved_filters_update" ON saved_filters FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- DELETE: Users can delete their own filters
CREATE POLICY "saved_filters_delete" ON saved_filters FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- ROLES POLICIES
-- ============================================================================
-- Everyone can read roles

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- TAG DIMENSIONS POLICIES
-- ============================================================================
-- All authenticated users can read tag dimensions (needed for tag creation)
-- Only admin/superadmin can modify tag dimensions

-- SELECT: All authenticated users can read tag dimensions
CREATE POLICY "tag_dimensions_select" ON tag_dimensions FOR SELECT TO authenticated USING (true);

-- INSERT: Only admin/superadmin can create tag dimensions
CREATE POLICY "tag_dimensions_insert" ON tag_dimensions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key IN ('admin', 'superadmin')
  )
  OR is_superadmin(auth.uid())
);

-- UPDATE: Only admin/superadmin can update tag dimensions
CREATE POLICY "tag_dimensions_update" ON tag_dimensions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key IN ('admin', 'superadmin')
  )
  OR is_superadmin(auth.uid())
);

-- DELETE: Only admin/superadmin can delete tag dimensions
CREATE POLICY "tag_dimensions_delete" ON tag_dimensions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key IN ('admin', 'superadmin')
  )
  OR is_superadmin(auth.uid())
);

-- ============================================================================
-- Enable RLS on all tables (if not already enabled)
-- ============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

