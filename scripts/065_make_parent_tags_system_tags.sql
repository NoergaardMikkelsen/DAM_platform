-- ============================================================================
-- Make Parent Tags System Tags
-- ============================================================================
-- This migration ensures that:
-- 1. All parent tags (parent_id IS NULL) are system tags (is_system = true, client_id = NULL)
-- 2. All subtags (parent_id IS NOT NULL) are client-specific (is_system = false)
-- 3. tag_dimensions are inherently system-wide (they don't have client_id)
-- ============================================================================

-- Step 1: Update all parent tags (parent_id IS NULL) to be system tags
-- Set is_system = true and client_id = NULL for all parent tags
UPDATE tags
SET 
  is_system = true,
  client_id = NULL
WHERE parent_id IS NULL
  AND (is_system = false OR client_id IS NOT NULL);

-- Step 2: Ensure all subtags (parent_id IS NOT NULL) are client-specific
-- Set is_system = false for all subtags (they should already have client_id)
UPDATE tags
SET is_system = false
WHERE parent_id IS NOT NULL
  AND is_system = true;

-- Step 3: Create a trigger to enforce this rule going forward
-- Parent tags must always be system tags (is_system = true, client_id = NULL)
-- Subtags must always be client-specific (is_system = false, client_id IS NOT NULL)

CREATE OR REPLACE FUNCTION enforce_tag_system_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a parent tag (parent_id IS NULL), it must be a system tag
  IF NEW.parent_id IS NULL THEN
    NEW.is_system = true;
    NEW.client_id = NULL;
  -- If this is a subtag (parent_id IS NOT NULL), it must be client-specific
  ELSIF NEW.parent_id IS NOT NULL THEN
    NEW.is_system = false;
    -- Ensure client_id is set for subtags
    IF NEW.client_id IS NULL THEN
      RAISE EXCEPTION 'Subtags must have a client_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_enforce_tag_system_rules ON tags;

-- Create trigger to enforce rules on insert and update
CREATE TRIGGER trigger_enforce_tag_system_rules
  BEFORE INSERT OR UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tag_system_rules();

-- Step 4: Add a check constraint to prevent invalid combinations
-- This ensures data integrity at the database level
ALTER TABLE tags DROP CONSTRAINT IF EXISTS check_tag_system_rules;
ALTER TABLE tags ADD CONSTRAINT check_tag_system_rules CHECK (
  -- Parent tags (parent_id IS NULL) must be system tags (is_system = true, client_id IS NULL)
  (parent_id IS NULL AND is_system = true AND client_id IS NULL)
  OR
  -- Subtags (parent_id IS NOT NULL) must be client-specific (is_system = false, client_id IS NOT NULL)
  (parent_id IS NOT NULL AND is_system = false AND client_id IS NOT NULL)
);


