-- ============================================================================
-- Allow Users to Edit Tags on Assets They Uploaded
-- ============================================================================
-- This migration updates the asset_tags INSERT and DELETE policies to allow
-- users (non-admin) to edit tags on assets they uploaded themselves
-- (assets.uploaded_by = auth.uid())
-- ============================================================================

-- Drop existing INSERT and DELETE policies
DROP POLICY IF EXISTS "asset_tags_insert" ON asset_tags;
DROP POLICY IF EXISTS "asset_tags_delete" ON asset_tags;

-- INSERT: Users can add tags to assets they uploaded OR admins can add tags to any asset
CREATE POLICY "asset_tags_insert" ON asset_tags FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_tags.asset_id
      AND has_client_access(auth.uid(), a.client_id)
      AND (
        is_admin_or_superadmin(auth.uid(), a.client_id)
        OR a.uploaded_by = auth.uid()  -- Users can add tags to assets they uploaded
      )
  )
);

-- DELETE: Users can remove tags from assets they uploaded OR admins can remove tags from any asset
CREATE POLICY "asset_tags_delete" ON asset_tags FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assets a
    WHERE a.id = asset_tags.asset_id
      AND has_client_access(auth.uid(), a.client_id)
      AND (
        is_admin_or_superadmin(auth.uid(), a.client_id)
        OR a.uploaded_by = auth.uid()  -- Users can remove tags from assets they uploaded
      )
  )
);

