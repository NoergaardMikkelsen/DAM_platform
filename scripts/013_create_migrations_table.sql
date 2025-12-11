-- Create table to track executed migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum TEXT,
  executed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at DESC);

-- Insert records for existing migrations that have already been run
-- This allows the migration system to recognize them as already executed
INSERT INTO schema_migrations (filename, executed_at, executed_by)
VALUES
  ('001_create_tables.sql', now(), 'manual'),
  ('002_rls_policies.sql', now(), 'manual'),
  ('003_create_profile_trigger.sql', now(), 'manual'),
  ('004_storage_setup.sql', now(), 'manual'),
  ('005_seed_data.sql', now(), 'manual'),
  ('006_create_first_superadmin.sql', now(), 'manual'),
  ('007_fix_rls_recursion.sql', now(), 'manual'),
  ('008_make_system_tags_global.sql', now(), 'manual'),
  ('009_storage_buckets_setup.sql', now(), 'manual'),
  ('010_enhance_system.sql', now(), 'manual'),
  ('011_make_category_mandatory.sql', now(), 'manual'),
  ('012_create_asset_versions.sql', now(), 'manual')
ON CONFLICT (filename) DO NOTHING;

