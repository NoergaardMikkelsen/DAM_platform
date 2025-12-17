-- Update storage policies to use is_superadmin() instead of system_admins table
-- Run this in Supabase SQL Editor to update storage policies

-- Drop old policies
DROP POLICY IF EXISTS "Allow system admins to upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow system admins to update logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow system admins to delete logos" ON storage.objects;

-- Recreate policies with is_superadmin()
CREATE POLICY "Allow superadmins to upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND is_superadmin(auth.uid())
);

CREATE POLICY "Allow superadmins to update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND is_superadmin(auth.uid())
);

CREATE POLICY "Allow superadmins to delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND is_superadmin(auth.uid())
);