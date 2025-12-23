-- Backfill file_type tags for all existing assets based on their mime_type
-- This ensures all assets have proper file_type tags assigned

DO $$
DECLARE
    asset_record RECORD;
    file_type_tag_id UUID;
BEGIN
    -- Loop through all assets that don't already have a file_type tag
    FOR asset_record IN
        SELECT a.id, a.client_id, a.mime_type
        FROM assets a
        WHERE a.status = 'active'
        AND a.mime_type IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM asset_tags at
            JOIN tags t ON at.tag_id = t.id
            WHERE at.asset_id = a.id AND t.dimension_key = 'file_type'
        )
    LOOP
        -- Get the appropriate file_type tag based on mime_type
        SELECT id INTO file_type_tag_id
        FROM tags
        WHERE dimension_key = 'file_type'
        AND (
            CASE
                WHEN asset_record.mime_type LIKE 'image/%' THEN slug = 'image'
                WHEN asset_record.mime_type LIKE 'video/%' THEN slug = 'video'
                WHEN asset_record.mime_type = 'application/pdf' THEN slug = 'pdf'
                WHEN asset_record.mime_type LIKE 'application/%' THEN slug = 'document'
                ELSE slug = 'other'
            END
        )
        AND (client_id IS NULL OR client_id = asset_record.client_id)
        LIMIT 1;

        -- If we found a matching file_type tag, assign it
        IF file_type_tag_id IS NOT NULL THEN
            INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, file_type_tag_id)
            ON CONFLICT (asset_id, tag_id) DO NOTHING;
            RAISE NOTICE 'Assigned file_type tag % to asset %', file_type_tag_id, asset_record.id;
        ELSE
            RAISE NOTICE 'No file_type tag found for mime_type % on asset %', asset_record.mime_type, asset_record.id;
        END IF;
    END LOOP;

    RAISE NOTICE 'File type backfill completed!';
END $$;
