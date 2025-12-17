-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Simplified helper functions that don't cause recursion by using SECURITY DEFINER with explicit table references

-- Helper function to check if user has access to a client (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION has_client_access(p_user_id UUID, p_client_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM client_users cu
    WHERE cu.user_id = p_user_id
      AND cu.client_id = p_client_id
      AND cu.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role key for a specific client
CREATE OR REPLACE FUNCTION get_user_role_key(p_user_id UUID, p_client_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT r.key
    FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = p_user_id
      AND cu.client_id = p_client_id
      AND cu.status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM system_admins
    WHERE id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ROLES: Everyone can read roles (no auth required for basic role info)
CREATE POLICY "roles_select" ON roles FOR SELECT USING (true);

-- CLIENTS: Users can see their own clients, superadmins can see all clients
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (has_client_access(auth.uid(), id) OR is_superadmin(auth.uid()));

CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (
    is_superadmin(auth.uid())
    OR get_user_role_key(auth.uid(), id) IN ('admin')
  );

CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (is_superadmin(auth.uid()));

-- USERS: Users can see their own profile and admins can see users in their clients
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id);

-- CLIENT_USERS: Direct check without recursion - users can see other users in the same client
CREATE POLICY "client_users_select" ON client_users FOR SELECT
  USING (
    user_id = auth.uid()  -- Users can see their own memberships
    OR has_client_access(auth.uid(), client_id)  -- Or users in the same client
  );

CREATE POLICY "client_users_insert" ON client_users FOR INSERT
  WITH CHECK (
    is_superadmin(auth.uid())
    OR get_user_role_key(auth.uid(), client_id) IN ('admin')
  );

CREATE POLICY "client_users_update" ON client_users FOR UPDATE
  USING (
    is_superadmin(auth.uid())
    OR get_user_role_key(auth.uid(), client_id) IN ('admin')
  );

CREATE POLICY "client_users_delete" ON client_users FOR DELETE
  USING (
    is_superadmin(auth.uid())
    OR get_user_role_key(auth.uid(), client_id) IN ('admin')
  );

-- SAVED_FILTERS: Users can manage their own filters or see public ones
CREATE POLICY "saved_filters_select" ON saved_filters FOR SELECT
  USING (
    is_public = true
    OR user_id = auth.uid()
    OR has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "saved_filters_insert" ON saved_filters FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "saved_filters_update" ON saved_filters FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "saved_filters_delete" ON saved_filters FOR DELETE
  USING (user_id = auth.uid());

-- TAGS: Users can see tags for their clients
CREATE POLICY "tags_select" ON tags FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "tags_insert" ON tags FOR INSERT
  WITH CHECK (
    get_user_role_key(auth.uid(), client_id) IN ('admin', 'superadmin')
  );

CREATE POLICY "tags_update" ON tags FOR UPDATE
  USING (
    get_user_role_key(auth.uid(), client_id) IN ('admin', 'superadmin')
  );

CREATE POLICY "tags_delete" ON tags FOR DELETE
  USING (
    is_system = false
    AND get_user_role_key(auth.uid(), client_id) IN ('admin', 'superadmin')
  );

-- ASSETS: Users can see assets for their clients
CREATE POLICY "assets_select" ON assets FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "assets_insert" ON assets FOR INSERT
  WITH CHECK (has_client_access(auth.uid(), client_id));

CREATE POLICY "assets_update" ON assets FOR UPDATE
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "assets_delete" ON assets FOR DELETE
  USING (
    get_user_role_key(auth.uid(), client_id) IN ('admin', 'superadmin')
  );

-- ASSET_TAGS: Follow asset permissions
CREATE POLICY "asset_tags_select" ON asset_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets WHERE assets.id = asset_tags.asset_id
        AND has_client_access(auth.uid(), assets.client_id)
    )
  );

CREATE POLICY "asset_tags_insert" ON asset_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets WHERE assets.id = asset_tags.asset_id
        AND has_client_access(auth.uid(), assets.client_id)
    )
  );

CREATE POLICY "asset_tags_delete" ON asset_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assets WHERE assets.id = asset_tags.asset_id
        AND has_client_access(auth.uid(), assets.client_id)
    )
  );

-- ASSET_EVENTS: Users can view events for their client's assets
CREATE POLICY "asset_events_select" ON asset_events FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "asset_events_insert" ON asset_events FOR INSERT
  WITH CHECK (has_client_access(auth.uid(), client_id));

-- FAVORITES: Users can manage their own favorites
CREATE POLICY "favorites_select" ON favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "favorites_insert" ON favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "favorites_delete" ON favorites FOR DELETE
  USING (user_id = auth.uid());
