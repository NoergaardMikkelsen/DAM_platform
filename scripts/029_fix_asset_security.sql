-- FIX ASSET SECURITY - Make assets private again
-- Revert the mistake of making assets public

-- Make assets bucket private again
UPDATE storage.buckets SET public = false WHERE id = 'assets';

-- Remove the incorrect public read policy
DROP POLICY IF EXISTS "Allow authenticated users to view assets" ON storage.objects;

-- Restore the correct client-based read policy
CREATE POLICY "Users can view assets from their clients"
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
