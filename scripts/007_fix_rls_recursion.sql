-- Drop all existing policies and helper functions to start fresh
DROP POLICY IF EXISTS client_users_select ON client_users;
DROP POLICY IF EXISTS client_users_insert ON client_users;
DROP POLICY IF EXISTS client_users_update ON client_users;
DROP POLICY IF EXISTS client_users_delete ON client_users;

DROP POLICY IF EXISTS assets_select ON assets;
DROP POLICY IF EXISTS assets_insert ON assets;
DROP POLICY IF EXISTS assets_update ON assets;
DROP POLICY IF EXISTS assets_delete ON assets;

DROP POLICY IF EXISTS tags_select ON tags;
DROP POLICY IF EXISTS tags_insert ON tags;
DROP POLICY IF EXISTS tags_update ON tags;
DROP POLICY IF EXISTS tags_delete ON tags;

DROP POLICY IF EXISTS asset_tags_select ON asset_tags;
DROP POLICY IF EXISTS asset_tags_insert ON asset_tags;
DROP POLICY IF EXISTS asset_tags_delete ON asset_tags;

DROP POLICY IF EXISTS asset_events_select ON asset_events;
DROP POLICY IF EXISTS asset_events_insert ON asset_events;

DROP POLICY IF EXISTS favorites_select ON favorites;
DROP POLICY IF EXISTS favorites_insert ON favorites;
DROP POLICY IF EXISTS favorites_delete ON favorites;

DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;

DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_update ON users;

DROP POLICY IF EXISTS roles_select ON roles;

DROP POLICY IF EXISTS saved_filters_select ON saved_filters;
DROP POLICY IF EXISTS saved_filters_insert ON saved_filters;
DROP POLICY IF EXISTS saved_filters_update ON saved_filters;
DROP POLICY IF EXISTS saved_filters_delete ON saved_filters;

-- Drop old helper functions
DROP FUNCTION IF EXISTS has_client_access(uuid);
DROP FUNCTION IF EXISTS get_user_role(uuid);
DROP FUNCTION IF EXISTS is_superadmin();

-- ============================================================================
-- NEW APPROACH: Self-contained policies without helper functions
-- ============================================================================

-- ROLES: Everyone can read roles
CREATE POLICY roles_select ON roles FOR SELECT TO authenticated USING (true);

-- USERS: Users can read and update their own profile
CREATE POLICY users_select ON users FOR SELECT TO authenticated 
USING (id = auth.uid());

CREATE POLICY users_update ON users FOR UPDATE TO authenticated 
USING (id = auth.uid());

-- CLIENT_USERS: Users can see their own client memberships
-- This is the critical table - NO helper functions that reference this table!
CREATE POLICY client_users_select ON client_users FOR SELECT TO authenticated 
USING (user_id = auth.uid());

-- Superadmins can insert/update/delete client_users
CREATE POLICY client_users_insert ON client_users FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  )
);

CREATE POLICY client_users_update ON client_users FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  )
);

CREATE POLICY client_users_delete ON client_users FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  )
);

-- CLIENTS: Users can see clients they belong to
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated 
USING (
  id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Superadmins can create/update clients
CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  )
);

CREATE POLICY clients_update ON clients FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  )
);

-- ASSETS: Users can see assets from their clients
CREATE POLICY assets_select ON assets FOR SELECT TO authenticated 
USING (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY assets_insert ON assets FOR INSERT TO authenticated 
WITH CHECK (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY assets_update ON assets FOR UPDATE TO authenticated 
USING (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY assets_delete ON assets FOR DELETE TO authenticated 
USING (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid() 
    AND cu.client_id = assets.client_id
    AND cu.status = 'active'
    AND r.key IN ('superadmin', 'admin')
  )
);

-- TAGS: Users can see tags from their clients
CREATE POLICY tags_select ON tags FOR SELECT TO authenticated 
USING (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY tags_insert ON tags FOR INSERT TO authenticated 
WITH CHECK (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY tags_update ON tags FOR UPDATE TO authenticated 
USING (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY tags_delete ON tags FOR DELETE TO authenticated 
USING (
  client_id IN (
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
  )
);

-- ASSET_TAGS: Users can manage tags on assets they can access
CREATE POLICY asset_tags_select ON asset_tags FOR SELECT TO authenticated 
USING (
  asset_id IN (
    SELECT a.id FROM assets a
    WHERE a.client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY asset_tags_insert ON asset_tags FOR INSERT TO authenticated 
WITH CHECK (
  asset_id IN (
    SELECT a.id FROM assets a
    WHERE a.client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY asset_tags_delete ON asset_tags FOR DELETE TO authenticated 
USING (
  asset_id IN (
    SELECT a.id FROM assets a
    WHERE a.client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- ASSET_EVENTS: Users can see and create events for their client's assets
CREATE POLICY asset_events_select ON asset_events FOR SELECT TO authenticated 
USING (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY asset_events_insert ON asset_events FOR INSERT TO authenticated 
WITH CHECK (
  client_id IN (
    SELECT client_id FROM client_users 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- FAVORITES: Users can manage their own favorites
CREATE POLICY favorites_select ON favorites FOR SELECT TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY favorites_insert ON favorites FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY favorites_delete ON favorites FOR DELETE TO authenticated 
USING (user_id = auth.uid());

-- SAVED_FILTERS: Users can manage their own saved filters
CREATE POLICY saved_filters_select ON saved_filters FOR SELECT TO authenticated 
USING (
  user_id = auth.uid() 
  OR is_public = true
);

CREATE POLICY saved_filters_insert ON saved_filters FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_filters_update ON saved_filters FOR UPDATE TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY saved_filters_delete ON saved_filters FOR DELETE TO authenticated 
USING (user_id = auth.uid());
