-- ============================================================================
-- Allow Users to Edit Tags They Created
-- ============================================================================
-- This migration updates the tags_update policy to allow users (non-admin)
-- to edit tags they created themselves (created_by = auth.uid())
-- ============================================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "tags_update" ON tags;

-- UPDATE: 
-- - System tags (client_id IS NULL) can only be edited by superadmin
-- - Client tags can be edited by:
--   - Admin/superadmin (all tags in their client)
--   - Users (only tags they created themselves: created_by = auth.uid())
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated
USING (
  -- System tags can only be edited by superadmin
  (client_id IS NULL AND is_superadmin(auth.uid()))
  OR
  -- Client tags can be edited by admin/superadmin OR by the user who created them
  (
    client_id IS NOT NULL
    AND has_client_access(auth.uid(), client_id)
    AND (
      is_admin_or_superadmin(auth.uid(), client_id)
      OR created_by = auth.uid()  -- Users can edit tags they created
    )
  )
);

