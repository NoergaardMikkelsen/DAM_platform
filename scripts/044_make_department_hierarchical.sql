-- Make Department hierarchical so it can have sub-tags
UPDATE tag_dimensions
SET is_hierarchical = true
WHERE dimension_key = 'department';

-- Create Department parent tag if it doesn't exist
INSERT INTO tags (client_id, dimension_key, parent_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id::uuid FROM clients LIMIT 1),
  'department',
  NULL::uuid,
  'category',
  'Department',
  'department',
  true,
  0,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE dimension_key = 'department' AND parent_id IS NULL
);

