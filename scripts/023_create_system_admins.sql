-- SYSTEM ADMINS TABLE (completely separate from client_users)
CREATE TABLE IF NOT EXISTS system_admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for system_admins
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- System admins can read their own record
CREATE POLICY "system_admins_read_own" ON system_admins
  FOR SELECT USING (auth.uid() = id);

-- Only existing system admins can create new ones
CREATE POLICY "system_admins_insert" ON system_admins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
    )
  );

-- System admins can update their own record
CREATE POLICY "system_admins_update_own" ON system_admins
  FOR UPDATE USING (auth.uid() = id);

-- Only existing system admins can delete others
CREATE POLICY "system_admins_delete" ON system_admins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
    )
  );

