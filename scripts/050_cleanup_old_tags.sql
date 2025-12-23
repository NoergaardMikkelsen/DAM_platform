-- Cleanup old irrelevant tags that don't fit the new dimension-based structure
-- This script removes old category tags that were migrated incorrectly and cleans up asset relationships

DO $$
DECLARE
    old_tag_record RECORD;
    tags_to_delete UUID[];
    deleted_count INTEGER := 0;
    brand_assets_parent_id UUID;
BEGIN
    RAISE NOTICE 'Starting cleanup of old irrelevant tags...';

    -- First, try to move "Brand assets" and "Logos" to brand_assets dimension if they exist
    SELECT id INTO brand_assets_parent_id 
    FROM tags 
    WHERE dimension_key = 'brand_assets' 
    AND parent_id IS NULL 
    LIMIT 1;

    IF brand_assets_parent_id IS NOT NULL THEN
        -- Move "Brand assets" and "Logos" from campaign to brand_assets dimension
        UPDATE tags
        SET dimension_key = 'brand_assets',
            parent_id = brand_assets_parent_id,
            tag_type = 'category'
        WHERE dimension_key = 'campaign'
        AND label IN ('Brand assets', 'Logos')
        AND parent_id IS NOT NULL;
        
        IF FOUND THEN
            RAISE NOTICE 'Moved Brand assets and Logos to brand_assets dimension';
        END IF;
    END IF;

    -- Find old tags that were migrated from category to campaign but don't make sense as campaign tags
    -- These are generic category names that shouldn't be campaign tags
    SELECT ARRAY_AGG(id) INTO tags_to_delete
    FROM tags
    WHERE dimension_key = 'campaign'
    AND parent_id IS NOT NULL  -- Only child tags, not parent
    AND label IN (
        'Products', 
        'Campaigns',  -- This is redundant - campaign dimension already exists
        'Employees',
        'Departments',
        'Office / Locations',
        'Press / PR',
        'Cases / Portfolio',
        'Events',
        'Video',
        'Social media assets',
        'Website assets',
        'Print / OOH',
        'Stock images',
        'Internal materials',
        'Print / Templates',
        'Templates',
        'Others'  -- Generic catch-all tag
    );

    -- If we found tags to delete
    IF tags_to_delete IS NOT NULL AND array_length(tags_to_delete, 1) > 0 THEN
        RAISE NOTICE 'Found % old tags to remove', array_length(tags_to_delete, 1);
        
        -- First, remove all asset_tag relationships for these tags
        DELETE FROM asset_tags
        WHERE tag_id = ANY(tags_to_delete);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Removed % asset_tag relationships for old tags', deleted_count;
        
        -- Then delete the tags themselves
        DELETE FROM tags
        WHERE id = ANY(tags_to_delete);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % old tags', deleted_count;
    ELSE
        RAISE NOTICE 'No old tags found to delete';
    END IF;

    -- Also check for tags with NULL or empty dimension_key (shouldn't exist after migrations)
    SELECT ARRAY_AGG(id) INTO tags_to_delete
    FROM tags
    WHERE dimension_key IS NULL 
    OR dimension_key = ''
    OR dimension_key NOT IN (
        SELECT dimension_key FROM tag_dimensions
    );

    IF tags_to_delete IS NOT NULL AND array_length(tags_to_delete, 1) > 0 THEN
        RAISE NOTICE 'Found % tags with invalid dimension_key to remove', array_length(tags_to_delete, 1);
        
        -- Remove asset_tag relationships
        DELETE FROM asset_tags
        WHERE tag_id = ANY(tags_to_delete);
        
        -- Delete tags
        DELETE FROM tags
        WHERE id = ANY(tags_to_delete);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % tags with invalid dimension_key', deleted_count;
    END IF;

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
    END IF;

    RAISE NOTICE 'Cleanup completed!';
END $$;

