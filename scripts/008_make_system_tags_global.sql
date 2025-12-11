-- Update RLS policies for tags to make system tags globally accessible

-- Drop existing tag policies
DROP POLICY IF EXISTS tags_select ON tags;
DROP POLICY IF EXISTS tags_insert ON tags;
DROP POLICY IF EXISTS tags_update ON tags;
DROP POLICY IF EXISTS tags_delete ON tags;

-- TAGS: Users can see system tags (is_system = true) OR tags from their clients
CREATE POLICY tags_select ON tags FOR SELECT TO authenticated 
USING (
  is_system = true  -- System tags are visible to everyone
  OR client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Users can insert tags to their own clients
CREATE POLICY tags_insert ON tags FOR INSERT TO authenticated 
WITH CHECK (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Users can update system tags if superadmin, or their own client's tags
CREATE POLICY tags_update ON tags FOR UPDATE TO authenticated 
USING (
  (is_system = true AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  ))
  OR client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Users can delete system tags if superadmin, or their own client's tags if admin+
CREATE POLICY tags_delete ON tags FOR DELETE TO authenticated 
USING (
  (is_system = true AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  ))
  OR (client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.client_id = tags.client_id
    AND cu.status = 'active'
    AND r.key IN ('superadmin', 'admin')
  ))
);
