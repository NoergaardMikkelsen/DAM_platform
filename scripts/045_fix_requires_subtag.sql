-- Fix requires_subtag for all hierarchical dimensions
-- Since parent tags are never selectable in UI, all hierarchical dimensions
-- effectively require sub-tags (users can only select sub-tags)
UPDATE tag_dimensions
SET requires_subtag = true
WHERE is_hierarchical = true;

