-- ============================================================================
-- Fix Recursive RLS Policies for Storage
-- ============================================================================
-- Storage policies use direct queries to client_users which can cause recursion.
-- This script fixes them by using the SECURITY DEFINER has_client_access function
-- instead of directly querying client_users within the policies.
-- ============================================================================

-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads to client folders" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their client assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their client assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to delete client assets" ON storage.objects;

-- Storage policy: Users can upload to their client folder
-- Uses has_client_access function (SECURITY DEFINER) to avoid recursion
CREATE POLICY "Allow authenticated uploads to client folders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND has_client_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

-- Storage policy: Users can view their client's assets
-- Uses has_client_access function (SECURITY DEFINER) to avoid recursion
CREATE POLICY "Allow users to view their client assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assets'
  AND has_client_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

-- Storage policy: Users can update their client's assets
-- Uses has_client_access function (SECURITY DEFINER) to avoid recursion
CREATE POLICY "Allow users to update their client assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets'
  AND has_client_access(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);

-- Storage policy: Admins can delete their client's assets
-- Uses is_admin_or_superadmin function (SECURITY DEFINER) to avoid recursion
CREATE POLICY "Allow admins to delete client assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND is_admin_or_superadmin(
    auth.uid(),
    (storage.foldername(name))[1]::uuid
  )
);


