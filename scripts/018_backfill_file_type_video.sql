-- Ensure Video file_type tag exists (system tag) and backfill assets for video

-- Add UNIQUE constraint on (client_id, slug, tag_type) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tags_client_id_slug_type_key'
  ) THEN
    ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_client_id_slug_key;
    ALTER TABLE tags ADD CONSTRAINT tags_client_id_slug_type_key UNIQUE (client_id, slug, tag_type);
  END IF;
END $$;

-- Insert Video file_type tag (system tag associated with first client)
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

-- Backfill file_type tags for all assets (includes video via get_file_type_tag_id)
INSERT INTO asset_tags (asset_id, tag_id)
SELECT 
  a.id AS asset_id,
  get_file_type_tag_id(a.mime_type) AS tag_id
FROM assets a
WHERE get_file_type_tag_id(a.mime_type) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM asset_tags at 
    WHERE at.asset_id = a.id 
      AND at.tag_id = get_file_type_tag_id(a.mime_type)
  );

-- Summary
SELECT 
  t.slug AS file_type,
  t.label AS file_type_label,
  COUNT(DISTINCT at.asset_id) AS asset_count
FROM tags t
LEFT JOIN asset_tags at ON at.tag_id = t.id
WHERE t.tag_type = 'file_type'
GROUP BY t.id, t.slug, t.label
ORDER BY t.sort_order;


