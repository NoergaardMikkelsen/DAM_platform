-- Add current/previous version pointers to assets
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID;

ALTER TABLE assets
  ADD CONSTRAINT fk_assets_current_version
    FOREIGN KEY (current_version_id) REFERENCES asset_versions(id) ON DELETE SET NULL;

ALTER TABLE assets
  ADD CONSTRAINT fk_assets_previous_version
    FOREIGN KEY (previous_version_id) REFERENCES asset_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_current_version ON assets(current_version_id);
CREATE INDEX IF NOT EXISTS idx_assets_previous_version ON assets(previous_version_id);


