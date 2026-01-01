-- ============================================================================
-- Fix system_admins RLS Policy to Remove Recursion
-- ============================================================================
-- The current system_admins_select policy has a recursive check that can
-- cause issues. This migration simplifies it to allow users to read their
-- own record, and superadmins can read all records via is_superadmin function.
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "system_admins_select" ON system_admins;

-- Create simplified policy: Users can see their own record
-- Superadmins can see all records via is_superadmin() function in queries
CREATE POLICY "system_admins_select" ON system_admins
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()  -- Users can see their own record
    OR is_superadmin(auth.uid())  -- Superadmins can see all records (via SECURITY DEFINER function)
  );

