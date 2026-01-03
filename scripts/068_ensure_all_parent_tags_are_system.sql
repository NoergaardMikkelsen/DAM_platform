-- ============================================================================
-- Ensure All Parent Tags Are System Tags
-- ============================================================================
-- This migration ensures that all parent tags (parent_id IS NULL) are properly
-- set as system tags (is_system = true, client_id = NULL)
-- ============================================================================

-- Update any parent tags that still have client_id set
UPDATE tags
SET 
  is_system = true,
  client_id = NULL
WHERE parent_id IS NULL
  AND (is_system = false OR client_id IS NOT NULL);

-- Verify: Check if there are any parent tags that are not system tags
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM tags
  WHERE parent_id IS NULL
    AND (is_system = false OR client_id IS NOT NULL);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % parent tags that are not properly set as system tags', invalid_count;
  ELSE
    RAISE NOTICE 'All parent tags are properly set as system tags';
  END IF;
END $$;


