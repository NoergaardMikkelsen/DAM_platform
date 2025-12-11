-- Add file_type tag type support and create system file_type tags

-- Insert system file_type tags
-- System tags are associated with the first client but made globally accessible via RLS policies
-- (see scripts/008_make_system_tags_global.sql)

INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id FROM clients LIMIT 1), -- Associate with first client (system tags are globally accessible via RLS)
  'file_type',
  unnest(ARRAY['Image', 'Video', 'PDF', 'Font', 'Icon', 'Document']),
  unnest(ARRAY['image', 'video', 'pdf', 'font', 'icon', 'document']),
  true,
  generate_series(1, 6),
  NULL
ON CONFLICT (client_id, slug) DO NOTHING;

-- Note: The tag_type column already accepts TEXT, so no schema change is needed
-- The constraint/check (if any) should already allow 'file_type' as a value
-- If there's a CHECK constraint, we may need to update it, but typically PostgreSQL
-- TEXT columns don't have restrictions unless explicitly added

