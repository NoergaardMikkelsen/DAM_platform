-- ============================================================================
-- Update Tags RLS Policies for Parent Tags
-- ============================================================================
-- This migration updates RLS policies to correctly handle parent tags
-- (which have client_id = NULL and is_system = true) vs subtags
-- (which have client_id IS NOT NULL and is_system = false)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "tags_insert" ON tags;
DROP POLICY IF EXISTS "tags_update" ON tags;
DROP POLICY IF EXISTS "tags_delete" ON tags;

-- INSERT: 
-- - Parent tags (client_id IS NULL, is_system = true) can only be created by superadmin
-- - Subtags (client_id IS NOT NULL, is_system = false) can be created by admin/superadmin/users
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated
WITH CHECK (
  -- Parent tags (system tags) can only be created by superadmin
  (client_id IS NULL AND is_system = true AND is_superadmin(auth.uid()))
  OR
  -- Subtags (client-specific) can be created by users with client access
  (
    client_id IS NOT NULL 
    AND is_system = false
    AND has_client_access(auth.uid(), client_id)
    AND (
      is_admin_or_superadmin(auth.uid(), client_id)
      -- Users can create tags, but application should restrict to upload context
    )
  )
);

-- UPDATE:
-- - Parent tags (system tags) can only be updated by superadmin
-- - Subtags can be updated by admin/superadmin/users (with restrictions)
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated
USING (
  -- Parent tags (system tags) can only be updated by superadmin
  (client_id IS NULL AND is_system = true AND is_superadmin(auth.uid()))
  OR
  -- Subtags can be updated by users with client access
  (
    client_id IS NOT NULL
    AND is_system = false
    AND has_client_access(auth.uid(), client_id)
    AND (
      is_admin_or_superadmin(auth.uid(), client_id)
      -- Users can edit tags, but application should restrict to own uploads
    )
  )
);

-- DELETE:
-- - Parent tags (system tags) can only be deleted by superadmin
-- - Subtags can be deleted by admin/superadmin
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
USING (
  -- Parent tags (system tags) can only be deleted by superadmin
  (client_id IS NULL AND is_system = true AND is_superadmin(auth.uid()))
  OR
  -- Subtags can be deleted by admin/superadmin
  (
    client_id IS NOT NULL
    AND is_system = false
    AND has_client_access(auth.uid(), client_id)
    AND is_admin_or_superadmin(auth.uid(), client_id)
  )
);


