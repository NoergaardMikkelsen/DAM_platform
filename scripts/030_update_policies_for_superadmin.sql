-- UPDATE POLICIES FOR SUPERADMIN ROLE
-- Replace system_admins checks with superadmin role checks
-- This migration updates storage policies and RLS policies to use superadmin role instead of system_admins table

-- ============================================
-- UPDATE STORAGE POLICIES FOR LOGOS BUCKET
-- ============================================

-- Drop existing logo policies (both old and new names in case they exist)
DROP POLICY IF EXISTS "Allow system admins to upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow system admins to update logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow system admins to delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow superadmins to upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow superadmins to update logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow superadmins to delete logos" ON storage.objects;

-- Create new policies using superadmin role check
CREATE POLICY "Allow superadmins to upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key = 'superadmin'
  )
);

CREATE POLICY "Allow superadmins to update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key = 'superadmin'
  )
);

CREATE POLICY "Allow superadmins to delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key = 'superadmin'
  )
);

-- ============================================
-- UPDATE RLS POLICIES FOR SYSTEM_SETTINGS
-- ============================================

-- Drop existing system_settings policies (will be recreated with same name but updated logic)
-- Note: We need to drop and recreate to update the USING clause
DROP POLICY IF EXISTS "system_settings_read" ON system_settings;
DROP POLICY IF EXISTS "system_settings_write" ON system_settings;

-- Create new policies using superadmin role check
CREATE POLICY "system_settings_read" ON system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_users cu
      JOIN roles r ON cu.role_id = r.id
      WHERE cu.user_id = auth.uid()
        AND cu.status = 'active'
        AND r.key = 'superadmin'
    )
  );

CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM client_users cu
      JOIN roles r ON cu.role_id = r.id
      WHERE cu.user_id = auth.uid()
        AND cu.status = 'active'
        AND r.key = 'superadmin'
    )
  );

