-- Remove content_type dimension as it overlaps with usage
-- Keep usage instead as it's more specific

DELETE FROM tag_dimensions WHERE dimension_key = 'content_type';

-- Update any existing content_type tags to usage dimension
UPDATE tags 
SET dimension_key = 'usage'
WHERE dimension_key = 'content_type';

