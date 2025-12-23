-- Remove parent tags from asset_tags
-- Parent tags are only organizational and should never be directly assigned to assets
-- Only child tags (sub-tags) should be assignable

DO $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Removing parent tags from asset_tags...';

    -- Remove parent tags from asset_tags (parent tags should never be directly assigned to assets)
    -- Parent tags are only organizational and should not be selectable
    DELETE FROM asset_tags
    WHERE tag_id IN (
        SELECT t.id
        FROM tags t
        INNER JOIN tag_dimensions td ON t.dimension_key = td.dimension_key
        WHERE td.is_hierarchical = true
        AND t.parent_id IS NULL
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Removed % parent tag assignments from assets', deleted_count;
    ELSE
        RAISE NOTICE 'No parent tag assignments found to remove';
    END IF;

    RAISE NOTICE 'Cleanup completed!';
END $$;

