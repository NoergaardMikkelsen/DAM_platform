-- ============================================================================
-- Add RLS Policies for tag_dimensions table
-- ============================================================================
-- This migration adds RLS policies for tag_dimensions table.
-- All authenticated users can read tag dimensions (needed for tag creation).
-- Only admin/superadmin can modify tag dimensions.
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tag_dimensions_select" ON tag_dimensions;
DROP POLICY IF EXISTS "tag_dimensions_insert" ON tag_dimensions;
DROP POLICY IF EXISTS "tag_dimensions_update" ON tag_dimensions;
DROP POLICY IF EXISTS "tag_dimensions_delete" ON tag_dimensions;

-- SELECT: All authenticated users can read tag dimensions (needed for tag creation)
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

-- Enable RLS on tag_dimensions table
ALTER TABLE tag_dimensions ENABLE ROW LEVEL SECURITY;


