-- Backfill: create a current version record for each existing asset (if missing)
INSERT INTO asset_versions (
  asset_id,
  client_id,
  version_label,
  storage_bucket,
  storage_path,
  mime_type,
  width,
  height,
  dpi,
  file_size,
  checksum,
  created_by
)
SELECT
  a.id,
  a.client_id,
  'initial',
  a.storage_bucket,
  a.storage_path,
  a.mime_type,
  a.width,
  a.height,
  NULL,
  a.file_size,
  NULL,
  a.uploaded_by
FROM assets a
LEFT JOIN asset_versions v ON v.asset_id = a.id
WHERE v.id IS NULL;

-- Set current_version_id to the latest version for each asset
UPDATE assets a
SET current_version_id = sub.id
FROM (
  SELECT DISTINCT ON (asset_id) id, asset_id, created_at
  FROM asset_versions
  ORDER BY asset_id, created_at DESC
) sub
WHERE sub.asset_id = a.id
  AND a.current_version_id IS NULL;


