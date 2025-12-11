-- Ensure file_type system tags are global (client_id NULL) and add missing Video tag

-- Make existing file_type system tags global to avoid slug conflicts with client-scoped tags
-- Allow same slug across different tag types by making tag_type part of the unique key
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_client_id_slug_key;
ALTER TABLE tags ADD CONSTRAINT tags_client_id_slug_type_key UNIQUE (client_id, slug, tag_type);

-- Insert Video file_type tag (system) using the first client to stay consistent with existing system tags
INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id FROM clients LIMIT 1),
  'file_type',
  'Video',
  'video',
  true,
  2,
  NULL
ON CONFLICT (client_id, slug, tag_type) DO NOTHING;


