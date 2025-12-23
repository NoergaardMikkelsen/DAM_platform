-- Enable multi-select for Campaign and Brand Assets
-- This allows assets to belong to multiple campaigns and brand asset types
UPDATE tag_dimensions
SET allows_multiple = true
WHERE dimension_key IN ('campaign', 'brand_assets');

