-- Create table to track derived/exported versions of assets
CREATE TABLE IF NOT EXISTS asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version_label TEXT,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  dpi INTEGER,
  file_size BIGINT,
  checksum TEXT,
  derived_from_version_id UUID REFERENCES asset_versions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_versions_created_at ON asset_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_versions_checksum ON asset_versions(checksum);
CREATE INDEX IF NOT EXISTS idx_asset_versions_derived ON asset_versions(derived_from_version_id);

ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_versions_select" ON asset_versions FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "asset_versions_insert" ON asset_versions FOR INSERT
  WITH CHECK (has_client_access(auth.uid(), client_id));

CREATE POLICY "asset_versions_update" ON asset_versions FOR UPDATE
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "asset_versions_delete" ON asset_versions FOR DELETE
  USING (
    get_user_role_key(auth.uid(), client_id) IN ('admin', 'superadmin')
  );

