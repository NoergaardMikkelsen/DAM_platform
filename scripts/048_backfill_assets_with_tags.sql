-- Backfill existing assets with random tags based on new tag_dimensions structure
-- This script randomly assigns tags to existing assets to simulate realistic data

DO $$
DECLARE
    asset_record RECORD;
    tag_record RECORD;
    campaign_parent_id UUID;
    brand_assets_parent_id UUID;
    selected_tag_id UUID;
    random_val FLOAT;
    tag_count INTEGER;
BEGIN
    -- Get parent tags for hierarchical dimensions
    SELECT id INTO campaign_parent_id FROM tags WHERE dimension_key = 'campaign' AND parent_id IS NULL LIMIT 1;
    SELECT id INTO brand_assets_parent_id FROM tags WHERE dimension_key = 'brand_assets' AND parent_id IS NULL LIMIT 1;

    -- Loop through all existing assets
    FOR asset_record IN
        SELECT a.id, a.client_id, a.title, a.mime_type
        FROM assets a
        WHERE a.status = 'active'
        AND NOT EXISTS (
            SELECT 1 FROM asset_tags at WHERE at.asset_id = a.id
        )
        ORDER BY a.created_at DESC
    LOOP
        RAISE NOTICE 'Processing asset: % - %', asset_record.id, asset_record.title;

        -- 1. CAMPAIGN (30% chance of assignment, hierarchical)
        IF random() < 0.3 THEN
            -- Get a random campaign child tag
            SELECT id INTO selected_tag_id
            FROM tags
            WHERE dimension_key = 'campaign'
            AND parent_id IS NOT NULL
            AND (client_id IS NULL OR client_id = asset_record.client_id)
            ORDER BY random()
            LIMIT 1;

            IF selected_tag_id IS NOT NULL THEN
                INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                ON CONFLICT (asset_id, tag_id) DO NOTHING;
                RAISE NOTICE '  - Assigned campaign tag: %', selected_tag_id;
            END IF;
        END IF;

        -- 2. BRAND ASSETS (20% chance, hierarchical)
        IF random() < 0.2 THEN
            -- Get a random brand assets child tag
            SELECT id INTO selected_tag_id
            FROM tags
            WHERE dimension_key = 'brand_assets'
            AND parent_id IS NOT NULL
            AND (client_id IS NULL OR client_id = asset_record.client_id)
            ORDER BY random()
            LIMIT 1;

            IF selected_tag_id IS NOT NULL THEN
                INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                ON CONFLICT (asset_id, tag_id) DO NOTHING;
                RAISE NOTICE '  - Assigned brand assets tag: %', selected_tag_id;
            END IF;
        END IF;

        -- 3. DEPARTMENT (40% chance, single select)
        IF random() < 0.4 THEN
            SELECT id INTO selected_tag_id
            FROM tags
            WHERE dimension_key = 'department'
            AND (client_id IS NULL OR client_id = asset_record.client_id)
            ORDER BY random()
            LIMIT 1;

            IF selected_tag_id IS NOT NULL THEN
                INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                ON CONFLICT (asset_id, tag_id) DO NOTHING;
                RAISE NOTICE '  - Assigned department tag: %', selected_tag_id;
            END IF;
        END IF;

        -- 4. VISUAL STYLE (50% chance, multi-select, up to 2 tags)
        SELECT COUNT(*) INTO tag_count FROM tags WHERE dimension_key = 'visual_style' AND (client_id IS NULL OR client_id = asset_record.client_id);
        IF tag_count > 0 AND random() < 0.5 THEN
            FOR i IN 1..(1 + floor(random() * 1))::integer LOOP -- 1-2 tags
                SELECT id INTO selected_tag_id
                FROM tags
                WHERE dimension_key = 'visual_style'
                AND (client_id IS NULL OR client_id = asset_record.client_id)
                AND id NOT IN (
                    SELECT tag_id FROM asset_tags WHERE asset_id = asset_record.id
                )
                ORDER BY random()
                LIMIT 1;

                IF selected_tag_id IS NOT NULL THEN
                    INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                    ON CONFLICT (asset_id, tag_id) DO NOTHING;
                    RAISE NOTICE '  - Assigned visual style tag: %', selected_tag_id;
                END IF;
            END LOOP;
        END IF;

        -- 5. USAGE (60% chance, multi-select, up to 3 tags)
        SELECT COUNT(*) INTO tag_count FROM tags WHERE dimension_key = 'usage' AND (client_id IS NULL OR client_id = asset_record.client_id);
        IF tag_count > 0 AND random() < 0.6 THEN
            FOR i IN 1..(1 + floor(random() * 2))::integer LOOP -- 1-3 tags
                SELECT id INTO selected_tag_id
                FROM tags
                WHERE dimension_key = 'usage'
                AND (client_id IS NULL OR client_id = asset_record.client_id)
                AND id NOT IN (
                    SELECT tag_id FROM asset_tags WHERE asset_id = asset_record.id
                )
                ORDER BY random()
                LIMIT 1;

                IF selected_tag_id IS NOT NULL THEN
                    INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                    ON CONFLICT (asset_id, tag_id) DO NOTHING;
                    RAISE NOTICE '  - Assigned usage tag: %', selected_tag_id;
                END IF;
            END LOOP;
        END IF;

        -- 6. THEME (30% chance, multi-select, up to 2 tags)
        SELECT COUNT(*) INTO tag_count FROM tags WHERE dimension_key = 'theme' AND (client_id IS NULL OR client_id = asset_record.client_id);
        IF tag_count > 0 AND random() < 0.3 THEN
            FOR i IN 1..(1 + floor(random() * 1))::integer LOOP -- 1-2 tags
                SELECT id INTO selected_tag_id
                FROM tags
                WHERE dimension_key = 'theme'
                AND (client_id IS NULL OR client_id = asset_record.client_id)
                AND id NOT IN (
                    SELECT tag_id FROM asset_tags WHERE asset_id = asset_record.id
                )
                ORDER BY random()
                LIMIT 1;

                IF selected_tag_id IS NOT NULL THEN
                    INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                    ON CONFLICT (asset_id, tag_id) DO NOTHING;
                    RAISE NOTICE '  - Assigned theme tag: %', selected_tag_id;
                END IF;
            END LOOP;
        END IF;

        -- 7. AUDIENCE (25% chance, multi-select, up to 2 tags)
        SELECT COUNT(*) INTO tag_count FROM tags WHERE dimension_key = 'audience' AND (client_id IS NULL OR client_id = asset_record.client_id);
        IF tag_count > 0 AND random() < 0.25 THEN
            FOR i IN 1..(1 + floor(random() * 1))::integer LOOP -- 1-2 tags
                SELECT id INTO selected_tag_id
                FROM tags
                WHERE dimension_key = 'audience'
                AND (client_id IS NULL OR client_id = asset_record.client_id)
                AND id NOT IN (
                    SELECT tag_id FROM asset_tags WHERE asset_id = asset_record.id
                )
                ORDER BY random()
                LIMIT 1;

                IF selected_tag_id IS NOT NULL THEN
                    INSERT INTO asset_tags (asset_id, tag_id) VALUES (asset_record.id, selected_tag_id)
                    ON CONFLICT (asset_id, tag_id) DO NOTHING;
                    RAISE NOTICE '  - Assigned audience tag: %', selected_tag_id;
                END IF;
            END LOOP;
        END IF;

    END LOOP;

    RAISE NOTICE 'Backfill completed! Assets have been randomly tagged.';
END $$;
