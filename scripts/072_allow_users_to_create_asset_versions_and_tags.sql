-- ============================================================================
-- Allow Users to Create Asset Versions and Tags
-- ============================================================================
-- This migration updates RLS policies to allow users (non-admin) to:
-- 1. Create asset_versions when uploading assets (initial version)
-- 2. Create tags (application logic checks allow_user_creation on tag_dimensions)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "asset_versions_insert" ON asset_versions;
DROP POLICY IF EXISTS "tags_insert" ON tags;

-- ASSET_VERSIONS INSERT: 
-- - Users can create initial versions when uploading assets (asset.uploaded_by = auth.uid())
-- - Admin/superadmin can create versions for any asset (replace files)
CREATE POLICY "asset_versions_insert" ON asset_versions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_versions.asset_id
      AND has_client_access(auth.uid(), a.client_id)
      AND (
        -- Users can create initial version when uploading (asset was uploaded by them)
        a.uploaded_by = auth.uid()
        OR
        -- Admin/superadmin can create versions for any asset (replace files)
        is_admin_or_superadmin(auth.uid(), a.client_id)
      )
  )
);

-- TAGS INSERT: 
-- - Parent tags (client_id IS NULL, is_system = true) can only be created by superadmin
-- - Subtags (client_id IS NOT NULL, is_system = false) can be created by all users with client access
--   (Application logic checks allow_user_creation on tag_dimensions)
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated
WITH CHECK (
  -- Parent tags (system tags) can only be created by superadmin
  (client_id IS NULL AND is_system = true AND is_superadmin(auth.uid()))
  OR
  -- Subtags (client-specific) can be created by all users with client access
  (
    client_id IS NOT NULL 
    AND is_system = false
    AND has_client_access(auth.uid(), client_id)
  )
);

