-- Migrate category_tag_id from assets table to asset_tags junction table
-- This unifies all tag relationships through the junction table

-- Migrate existing category_tag_id relationships to asset_tags
INSERT INTO asset_tags (asset_id, tag_id)
SELECT 
  a.id AS asset_id,
  a.category_tag_id AS tag_id
FROM assets a
WHERE a.category_tag_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM asset_tags at 
  WHERE at.asset_id = a.id 
  AND at.tag_id = a.category_tag_id
);

-- Remove category_tag_id column from assets table
ALTER TABLE assets DROP COLUMN IF EXISTS category_tag_id;

-- Add comment explaining the change
COMMENT ON TABLE asset_tags IS 'Unified junction table for all asset-tag relationships. Previously category tags were stored directly in assets.category_tag_id, now all tags go through this table.';

