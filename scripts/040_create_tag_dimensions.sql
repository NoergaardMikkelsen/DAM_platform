-- Create tag_dimensions table for multi-dimensional tagging system
-- This migration introduces hierarchical tags and dimension-based organization

-- Create tag_dimensions configuration table
CREATE TABLE IF NOT EXISTS tag_dimensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dimension_key TEXT UNIQUE NOT NULL, -- 'campaign', 'brand_assets', 'department', etc.
  label TEXT NOT NULL, -- Display name: 'Campaign', 'Brand Assets'
  is_hierarchical BOOLEAN DEFAULT false,
  requires_subtag BOOLEAN DEFAULT false,
  allows_multiple BOOLEAN DEFAULT true,
  required BOOLEAN DEFAULT false,
  display_order INTEGER NOT NULL,
  generates_collection BOOLEAN DEFAULT false, -- Which dimensions create collections
  allow_user_creation BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert dimension configurations
-- Approach 4: Smart Collections - only selected dimensions generate collections
INSERT INTO tag_dimensions (dimension_key, label, is_hierarchical, requires_subtag, allows_multiple, required, display_order, generates_collection, allow_user_creation) VALUES
('campaign', 'Campaign', true, true, false, false, 1, true, true),      -- Generates collections, hierarchical, requires subtag, optional
('brand_assets', 'Brand Assets', true, false, false, false, 2, true, true), -- Generates collections, hierarchical, optional subtag
('department', 'Department', false, false, true, false, 3, false, true),    -- Filter only, optional
('content_type', 'Content Type', false, false, true, false, 4, false, false), -- Filter only, optional, controlled vocab
('file_type', 'File Type', false, false, true, false, 5, false, false),     -- Auto-assigned, filter only
('visual_style', 'Visual Style', false, false, true, false, 6, false, true), -- Filter only, optional
('theme', 'Theme', false, false, true, false, 7, false, true),              -- Filter only, optional
('usage', 'Usage', false, false, true, false, 8, false, true),              -- Filter only, optional
('audience', 'Target Audience', false, false, true, false, 9, false, true) -- Filter only, optional
ON CONFLICT (dimension_key) DO NOTHING;

-- Add dimension_key and parent_id to tags table
ALTER TABLE tags ADD COLUMN IF NOT EXISTS dimension_key TEXT REFERENCES tag_dimensions(dimension_key);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tags(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tags_dimension_key ON tags(dimension_key);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_dimension_parent ON tags(dimension_key, parent_id);

-- Migrate existing tag_type to dimension_key
-- Map old tag types to new dimensions
UPDATE tags SET dimension_key = CASE
  WHEN tag_type = 'category' THEN 'campaign' -- Default category to campaign for now
  WHEN tag_type = 'description' THEN 'theme'
  WHEN tag_type = 'usage' THEN 'usage'
  WHEN tag_type = 'visual_style' THEN 'visual_style'
  WHEN tag_type = 'file_type' THEN 'file_type'
  ELSE 'theme' -- Default fallback
END
WHERE dimension_key IS NULL;

-- Create parent tags for hierarchical dimensions
-- Campaign parent
INSERT INTO tags (client_id, dimension_key, parent_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id::uuid FROM clients LIMIT 1),
  'campaign',
  NULL::uuid,
  'category', -- Keep tag_type for backward compatibility
  'Campaign',
  'campaign',
  true,
  0,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE dimension_key = 'campaign' AND parent_id IS NULL
);

-- Brand Assets parent
INSERT INTO tags (client_id, dimension_key, parent_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id::uuid FROM clients LIMIT 1),
  'brand_assets',
  NULL::uuid,
  'category', -- Keep tag_type for backward compatibility
  'Brand Assets',
  'brand-assets',
  true,
  0,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE dimension_key = 'brand_assets' AND parent_id IS NULL
);

-- Update existing category tags to be children of Campaign parent
UPDATE tags t1
SET parent_id = (
  SELECT id::uuid FROM tags t2 
  WHERE t2.dimension_key = 'campaign' 
  AND t2.parent_id IS NULL 
  LIMIT 1
)::uuid
WHERE t1.dimension_key = 'campaign' 
AND t1.parent_id IS NULL
AND t1.label != 'Campaign';

-- Add updated_at trigger for tag_dimensions
CREATE OR REPLACE FUNCTION update_tag_dimensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_dimensions_updated_at
BEFORE UPDATE ON tag_dimensions
FOR EACH ROW
EXECUTE FUNCTION update_tag_dimensions_updated_at();

