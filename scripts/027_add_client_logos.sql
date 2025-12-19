-- ADD CLIENT LOGO SUPPORT
-- Add logo_url field to clients table and create logos storage bucket

-- Add logo_url field to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create logos bucket for client logos (public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true, -- Public bucket for logos
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Storage policy: Superadmins can upload logos
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

-- Storage policy: Everyone can view logos (public bucket)
CREATE POLICY "Allow everyone to view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Storage policy: Superadmins can update logos
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

-- Storage policy: Superadmins can delete logos
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

