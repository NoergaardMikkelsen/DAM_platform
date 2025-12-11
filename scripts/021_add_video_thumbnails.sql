-- Add thumbnail_path column to asset_versions table
ALTER TABLE asset_versions
ADD COLUMN thumbnail_path TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN asset_versions.thumbnail_path IS 'Path to thumbnail image for video assets in the assets storage bucket';
