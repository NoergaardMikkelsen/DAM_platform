-- Update RLS policies to use is_superadmin() function instead of system_admins table

-- Update system_settings policies
DROP POLICY IF EXISTS "system_settings_read" ON system_settings;
DROP POLICY IF EXISTS "system_settings_write" ON system_settings;

CREATE POLICY "system_settings_read" ON system_settings
  FOR SELECT USING (is_superadmin(auth.uid()));

CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL USING (is_superadmin(auth.uid()));

-- Update storage policies for logos (from 027_add_client_logos.sql)
-- These policies are on storage.objects table, not directly accessible via SQL scripts
-- They need to be updated in Supabase dashboard or via SQL editor