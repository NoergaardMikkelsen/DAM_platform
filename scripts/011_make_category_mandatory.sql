-- Make category_tag_id mandatory for assets
-- This ensures every asset belongs to a collection (category)

-- First, let's check if there are any assets without category_tag_id
-- and assign them a default category if needed

DO $$
DECLARE
  v_default_category_id uuid;
BEGIN
  -- Get the first category tag as default (preferably "Others" or similar)
  SELECT id INTO v_default_category_id
  FROM tags
  WHERE tag_type = 'category'
  ORDER BY 
    CASE WHEN slug = 'others' THEN 0 ELSE 1 END,
    sort_order
  LIMIT 1;

  -- If we have a default category, update any assets without one
  IF v_default_category_id IS NOT NULL THEN
    UPDATE assets
    SET category_tag_id = v_default_category_id,
        updated_at = now()
    WHERE category_tag_id IS NULL;
  END IF;
END $$;

-- Add NOT NULL constraint to category_tag_id
-- This ensures all future assets must have a category
ALTER TABLE assets
ALTER COLUMN category_tag_id SET NOT NULL;

-- Add a foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'assets_category_tag_id_fkey'
  ) THEN
    ALTER TABLE assets
    ADD CONSTRAINT assets_category_tag_id_fkey
    FOREIGN KEY (category_tag_id) REFERENCES tags(id);
  END IF;
END $$;

-- Create an "Others" category if it doesn't exist (fallback category)
INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order)
SELECT 
  (SELECT id FROM clients LIMIT 1),
  'category',
  'Others',
  'others',
  true,
  999
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE tag_type = 'category' AND slug = 'others'
);
