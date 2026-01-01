-- ============================================================================
-- Fix Tags SELECT Policy for System Tags
-- ============================================================================
-- This migration updates the tags_select policy to ensure system tags
-- (is_system = true, client_id = NULL) are visible to all authenticated users
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "tags_select" ON tags;

-- SELECT: All authenticated users can view:
-- - System tags (is_system = true, client_id = NULL) - visible to everyone
-- - Client-specific tags (is_system = false, client_id IS NOT NULL) - visible to users with client access
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated
USING (
  -- System tags (parent tags) are visible to all authenticated users
  (is_system = true AND client_id IS NULL)
  OR
  -- Client-specific tags (subtags) are visible to users with client access
  (is_system = false AND client_id IS NOT NULL AND has_client_access(auth.uid(), client_id))
);

