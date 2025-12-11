-- Optional: Database function to automatically assign file_type tags
-- This ensures consistency even if upload flow changes

-- Function to get file type tag ID from mime_type
CREATE OR REPLACE FUNCTION get_file_type_tag_id(p_mime_type TEXT)
RETURNS UUID AS $$
DECLARE
  v_file_type_slug TEXT;
  v_tag_id UUID;
BEGIN
  -- Determine file type slug from mime_type
  IF p_mime_type LIKE 'image/%' THEN
    -- Check for icon types
    IF p_mime_type IN ('image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/x-ico', 'image/ico', 'image/icon') THEN
      v_file_type_slug := 'icon';
    ELSE
      v_file_type_slug := 'image';
    END IF;
  ELSIF p_mime_type LIKE 'video/%' THEN
    v_file_type_slug := 'video';
  ELSIF p_mime_type = 'application/pdf' THEN
    v_file_type_slug := 'pdf';
  ELSIF p_mime_type LIKE 'font/%' OR p_mime_type LIKE 'application/font%' OR 
        p_mime_type IN ('application/x-font-ttf', 'application/x-font-truetype', 
                        'application/x-font-opentype', 'application/vnd.ms-fontobject',
                        'application/font-woff', 'application/font-woff2') THEN
    v_file_type_slug := 'font';
  ELSIF p_mime_type IN ('application/msword', 
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'application/vnd.oasis.opendocument.text',
                        'application/vnd.oasis.opendocument.spreadsheet',
                        'application/vnd.oasis.opendocument.presentation',
                        'application/rtf', 'text/plain', 'text/csv') THEN
    v_file_type_slug := 'document';
  ELSE
    RETURN NULL;
  END IF;

  -- Find the file_type tag
  SELECT id INTO v_tag_id
  FROM tags
  WHERE tag_type = 'file_type'
    AND slug = v_file_type_slug
    AND is_system = true
  LIMIT 1;

  RETURN v_tag_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign file_type tag on asset insert
CREATE OR REPLACE FUNCTION auto_assign_file_type_tag()
RETURNS TRIGGER AS $$
DECLARE
  v_file_type_tag_id UUID;
BEGIN
  -- Get file type tag ID
  v_file_type_tag_id := get_file_type_tag_id(NEW.mime_type);

  -- If a file type tag was found, assign it
  IF v_file_type_tag_id IS NOT NULL THEN
    -- Insert asset_tag relationship (ignore if already exists)
    INSERT INTO asset_tags (asset_id, tag_id)
    VALUES (NEW.id, v_file_type_tag_id)
    ON CONFLICT (asset_id, tag_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (commented out by default - uncomment to enable)
-- DROP TRIGGER IF EXISTS trigger_auto_assign_file_type_tag ON assets;
-- CREATE TRIGGER trigger_auto_assign_file_type_tag
--   AFTER INSERT ON assets
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_assign_file_type_tag();

-- Note: The trigger is commented out because the application layer handles this.
-- Uncomment the trigger lines above if you prefer database-level enforcement.

