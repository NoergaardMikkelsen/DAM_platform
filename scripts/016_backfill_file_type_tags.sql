-- Backfill file_type tags for existing assets
-- This script assigns file_type tags to all existing assets based on their mime_type

-- Use the helper function to assign file_type tags to existing assets
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

-- Summary query to see how many assets were tagged
SELECT 
  t.slug AS file_type,
  t.label AS file_type_label,
  COUNT(DISTINCT at.asset_id) AS asset_count
FROM tags t
LEFT JOIN asset_tags at ON at.tag_id = t.id
WHERE t.tag_type = 'file_type'
GROUP BY t.id, t.slug, t.label
ORDER BY t.sort_order;

