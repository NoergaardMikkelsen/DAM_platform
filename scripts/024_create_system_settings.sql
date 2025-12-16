-- SYSTEM SETTINGS TABLE
-- Stores global system configuration like base domain, etc.

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only system admins can read system settings
CREATE POLICY "system_settings_read" ON system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
    )
  );

-- Only system admins can modify system settings
CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
    )
  );

-- Insert base domain setting
INSERT INTO system_settings (key, value, description)
VALUES (
  'base_domain',
  'brandassets.space',
  'The base domain for automatic subdomain generation'
)
ON CONFLICT (key) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_updated_at_trigger
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();
