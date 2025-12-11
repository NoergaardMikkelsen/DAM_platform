-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Users can upload assets to their client bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can view assets from their clients" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete assets from their clients" ON storage.objects;

-- Create main assets bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'assets',
  'assets',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 
        'video/mp4', 'video/quicktime', 'video/webm',
        'application/pdf', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 
                              'video/mp4', 'video/quicktime', 'video/webm',
                              'application/pdf', 'application/zip'];

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policy: Users can upload to their client folder
CREATE POLICY "Allow authenticated uploads to client folders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] IN (
    SELECT cu.client_id::text
    FROM client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
  )
);

-- Storage policy: Users can view their client's assets
CREATE POLICY "Allow users to view their client assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] IN (
    SELECT cu.client_id::text
    FROM client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
  )
);

-- Storage policy: Users can update their client's assets
CREATE POLICY "Allow users to update their client assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] IN (
    SELECT cu.client_id::text
    FROM client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
  )
);

-- Storage policy: Admins can delete their client's assets
CREATE POLICY "Allow admins to delete client assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] IN (
    SELECT cu.client_id::text
    FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'active'
      AND r.key IN ('admin', 'superadmin')
  )
);
