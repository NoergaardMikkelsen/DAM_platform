-- ============================================================================
-- Create System Admins Table
-- ============================================================================
-- This creates a dedicated system_admins table to properly separate
-- superadmin access from client/tenant access, replacing the SYSTEM_CLIENT_ID
-- workaround.
-- ============================================================================

-- Drop existing table if it exists (to recreate with role_id column)
DROP TABLE IF EXISTS system_admins CASCADE;

-- Create system_admins table
-- This table links users to the superadmin role from the roles table
CREATE TABLE system_admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint to ensure the role is actually the superadmin role
-- Note: CHECK constraints with subqueries are not supported in PostgreSQL
-- We'll rely on application logic and foreign key constraint instead

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_admins_id ON system_admins(id);
CREATE INDEX IF NOT EXISTS idx_system_admins_role_id ON system_admins(role_id);

-- Enable RLS on system_admins table
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_admins
-- System admins can read their own record
CREATE POLICY "system_admins_select" ON system_admins
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()  -- Users can see their own record
    OR EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()  -- System admins can see all records
    )
  );

-- Only existing system admins can create new ones
CREATE POLICY "system_admins_insert" ON system_admins
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
    )
  );

-- System admins can update their own record
CREATE POLICY "system_admins_update" ON system_admins
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()  -- Users can update their own record
    OR EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()  -- System admins can update all records
    )
  );

-- Only existing system admins can delete others
CREATE POLICY "system_admins_delete" ON system_admins
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
    )
  );

-- Update is_superadmin function to use system_admins table
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

-- Migrate existing superadmins from SYSTEM_CLIENT_ID to system_admins table
-- This migrates users who have superadmin role in the SYSTEM_CLIENT_ID
-- Get the superadmin role ID first
DO $$
DECLARE
  superadmin_role_id UUID;
BEGIN
  -- Get the superadmin role ID
  SELECT id INTO superadmin_role_id
  FROM roles
  WHERE key = 'superadmin'
  LIMIT 1;

  -- Only migrate if superadmin role exists
  IF superadmin_role_id IS NOT NULL THEN
    INSERT INTO system_admins (id, role_id)
    SELECT DISTINCT cu.user_id, superadmin_role_id
    FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.client_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'  -- SYSTEM_CLIENT_ID
      AND cu.status = 'active'
      AND r.key = 'superadmin'
      AND NOT EXISTS (
        SELECT 1 FROM system_admins sa
        WHERE sa.id = cu.user_id
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_admins_updated_at ON system_admins;
CREATE TRIGGER trigger_update_system_admins_updated_at
  BEFORE UPDATE ON system_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_system_admins_updated_at();

