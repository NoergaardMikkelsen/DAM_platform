-- Update dimension requirements - make department and content_type optional
UPDATE tag_dimensions
SET required = false
WHERE dimension_key IN ('department', 'content_type');

