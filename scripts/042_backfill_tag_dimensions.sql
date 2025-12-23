-- Backfill existing tags with proper dimension_key values
-- This migration ensures all existing tags have the correct dimension_key set

-- Update tags that don't have dimension_key set yet
UPDATE tags
SET dimension_key = CASE
  WHEN tag_type = 'category' THEN 'campaign'
  WHEN tag_type = 'description' THEN 'theme'
  WHEN tag_type = 'usage' THEN 'usage'
  WHEN tag_type = 'visual_style' THEN 'visual_style'
  WHEN tag_type = 'file_type' THEN 'file_type'
  ELSE COALESCE(dimension_key, 'theme') -- Default to theme if no match
END
WHERE dimension_key IS NULL OR dimension_key = '';

-- Set parent_id for existing campaign tags (make them children of Campaign parent)
UPDATE tags t1
SET parent_id = (
  SELECT id FROM tags t2 
  WHERE t2.dimension_key = 'campaign' 
  AND t2.parent_id IS NULL
  AND t2.label = 'Campaign'
  LIMIT 1
)::uuid
WHERE t1.dimension_key = 'campaign' 
AND t1.parent_id IS NULL
AND t1.label != 'Campaign'
AND EXISTS (
  SELECT 1 FROM tags t2 
  WHERE t2.dimension_key = 'campaign' 
  AND t2.parent_id IS NULL
  AND t2.label = 'Campaign'
);

-- Set parent_id for existing brand_assets tags (make them children of Brand Assets parent)
UPDATE tags t1
SET parent_id = (
  SELECT id FROM tags t2 
  WHERE t2.dimension_key = 'brand_assets' 
  AND t2.parent_id IS NULL
  AND t2.label = 'Brand Assets'
  LIMIT 1
)::uuid
WHERE t1.dimension_key = 'brand_assets' 
AND t1.parent_id IS NULL
AND t1.label != 'Brand Assets'
AND EXISTS (
  SELECT 1 FROM tags t2 
  WHERE t2.dimension_key = 'brand_assets' 
  AND t2.parent_id IS NULL
  AND t2.label = 'Brand Assets'
);

-- Ensure all tags have tag_type set (for backward compatibility)
UPDATE tags
SET tag_type = CASE
  WHEN dimension_key = 'campaign' THEN 'category'
  WHEN dimension_key = 'brand_assets' THEN 'category'
  WHEN dimension_key = 'department' THEN 'description'
  WHEN dimension_key = 'content_type' THEN 'category'
  WHEN dimension_key = 'theme' THEN 'description'
  WHEN dimension_key = 'visual_style' THEN 'visual_style'
  WHEN dimension_key = 'usage' THEN 'usage'
  WHEN dimension_key = 'file_type' THEN 'file_type'
  ELSE COALESCE(tag_type, 'description')
END
WHERE tag_type IS NULL OR tag_type = '';

