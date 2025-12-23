-- DELETE ALL ASSETS FROM ALL CLIENTS
-- WARNING: This is a destructive operation that cannot be undone!
-- This will delete:
-- - All assets
-- - All asset_tags relationships
-- - All asset_versions
-- - All asset_events
-- - All favorites
-- Files in storage buckets are NOT deleted (manual cleanup required)

DO $$
DECLARE
    deleted_assets INTEGER := 0;
    deleted_asset_tags INTEGER := 0;
    deleted_asset_versions INTEGER := 0;
    deleted_asset_events INTEGER := 0;
    deleted_favorites INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting deletion of all assets...';
    RAISE NOTICE 'WARNING: This is a destructive operation!';

    -- Delete asset_tags (junction table - must be deleted first due to foreign keys)
    DELETE FROM asset_tags;
    GET DIAGNOSTICS deleted_asset_tags = ROW_COUNT;
    RAISE NOTICE 'Deleted % asset_tags relationships', deleted_asset_tags;

    -- Delete asset_events
    DELETE FROM asset_events;
    GET DIAGNOSTICS deleted_asset_events = ROW_COUNT;
    RAISE NOTICE 'Deleted % asset_events', deleted_asset_events;

    -- Delete favorites
    DELETE FROM favorites;
    GET DIAGNOSTICS deleted_favorites = ROW_COUNT;
    RAISE NOTICE 'Deleted % favorites', deleted_favorites;

    -- Delete asset_versions
    DELETE FROM asset_versions;
    GET DIAGNOSTICS deleted_asset_versions = ROW_COUNT;
    RAISE NOTICE 'Deleted % asset_versions', deleted_asset_versions;

    -- Finally delete assets
    DELETE FROM assets;
    GET DIAGNOSTICS deleted_assets = ROW_COUNT;
    RAISE NOTICE 'Deleted % assets', deleted_assets;

    RAISE NOTICE 'Deletion completed!';
    RAISE NOTICE 'Note: Files in storage buckets are NOT deleted. Manual cleanup required.';
END $$;

