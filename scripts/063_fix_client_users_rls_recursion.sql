-- ============================================================================
-- Fix Recursive RLS Policy for client_users table
-- ============================================================================
-- The client_users_select policy has a recursive check that causes 500 errors.
-- This script fixes it by using the SECURITY DEFINER has_client_access function
-- instead of directly querying client_users within the policy.
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "client_users_select" ON client_users;

-- Recreate SELECT policy without recursion
-- Users can see their own memberships and memberships for clients they have access to
-- Uses has_client_access function (SECURITY DEFINER) to avoid recursion
CREATE POLICY "client_users_select" ON client_users FOR SELECT TO authenticated
USING (
  user_id = auth.uid()  -- Users can see their own memberships
  OR has_client_access(auth.uid(), client_id)  -- Users can see memberships for clients they have access to
  OR is_superadmin(auth.uid())  -- Superadmins can see all memberships
);


