-- Create storage buckets for assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assets', 'assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assets bucket
CREATE POLICY "Users can upload assets to their client bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets'
  AND auth.uid() IN (
    SELECT cu.user_id
    FROM client_users cu
    WHERE cu.status = 'active'
  )
);

CREATE POLICY "Users can view assets from their clients"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assets'
  AND auth.uid() IN (
    SELECT cu.user_id
    FROM client_users cu
    JOIN assets a ON a.client_id = cu.client_id
    WHERE cu.status = 'active'
      AND storage.objects.name LIKE a.client_id::text || '%'
  )
);

CREATE POLICY "Users can delete assets from their clients"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets'
  AND auth.uid() IN (
    SELECT cu.user_id
    FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    JOIN assets a ON a.client_id = cu.client_id
    WHERE cu.status = 'active'
      AND r.key IN ('admin', 'superadmin')
      AND storage.objects.name LIKE a.client_id::text || '%'
  )
);
