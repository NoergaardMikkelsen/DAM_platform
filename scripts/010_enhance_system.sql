-- Add storage tracking to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- Create function to update client storage usage
CREATE OR REPLACE FUNCTION update_client_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clients 
    SET storage_used_bytes = storage_used_bytes + NEW.file_size
    WHERE id = NEW.client_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clients 
    SET storage_used_bytes = storage_used_bytes - OLD.file_size
    WHERE id = OLD.client_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle file size changes
    IF OLD.client_id = NEW.client_id THEN
      UPDATE clients 
      SET storage_used_bytes = storage_used_bytes - OLD.file_size + NEW.file_size
      WHERE id = NEW.client_id;
    ELSE
      -- Handle client transfer (rare case)
      UPDATE clients SET storage_used_bytes = storage_used_bytes - OLD.file_size WHERE id = OLD.client_id;
      UPDATE clients SET storage_used_bytes = storage_used_bytes + NEW.file_size WHERE id = NEW.client_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for storage tracking
DROP TRIGGER IF EXISTS track_client_storage ON assets;
CREATE TRIGGER track_client_storage
  AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_client_storage_usage();

-- Update existing storage usage (run once)
UPDATE clients c
SET storage_used_bytes = COALESCE(
  (SELECT SUM(file_size) FROM assets WHERE client_id = c.id AND status = 'active'),
  0
);

-- Create view for client storage statistics
CREATE OR REPLACE VIEW client_storage_stats AS
SELECT 
  c.id,
  c.name,
  c.storage_limit_mb,
  c.storage_used_bytes,
  ROUND((c.storage_used_bytes::NUMERIC / 1024 / 1024)::NUMERIC, 2) as storage_used_mb,
  ROUND((c.storage_used_bytes::NUMERIC / (c.storage_limit_mb * 1024 * 1024) * 100)::NUMERIC, 2) as storage_percentage,
  (SELECT COUNT(*) FROM assets WHERE client_id = c.id AND status = 'active') as asset_count,
  (SELECT COUNT(*) FROM client_users WHERE client_id = c.id AND status = 'active') as user_count
FROM clients c;

-- Seed system tags with proper types
INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id FROM clients LIMIT 1), -- Associate with first client for now
  'category',
  unnest(ARRAY['Employees', 'Departments', 'Office / Locations', 'Brand assets', 'Logos', 'Press / PR', 'Products', 'Cases / Portfolio', 'Events', 'Campaigns', 'Video', 'Social media assets', 'Website assets', 'Print / OOH', 'Stock images', 'Internal materials', 'Print / Templates', 'Templates', 'Others']),
  unnest(ARRAY['employees', 'departments', 'office-locations', 'brand-assets', 'logos', 'press-pr', 'products', 'cases-portfolio', 'events', 'campaigns', 'video', 'social-media-assets', 'website-assets', 'print-ooh', 'stock-images', 'internal-materials', 'print-templates', 'templates', 'others']),
  true,
  generate_series(1, 19),
  NULL
ON CONFLICT (client_id, slug) DO NOTHING;

INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id FROM clients LIMIT 1),
  'description',
  unnest(ARRAY['Summer', 'Winter', 'Christmas', 'Easter', '2024', '2025', 'New office', 'Moodboard', 'Portrait', 'Team', 'Corporate', 'Lifestyle', 'Urban', 'Outdoor', 'Packaging', 'Editorial', 'Behind the scenes', 'Product shots', 'Background']),
  unnest(ARRAY['summer', 'winter', 'christmas', 'easter', '2024', '2025', 'new-office', 'moodboard', 'portrait', 'team', 'corporate', 'lifestyle', 'urban', 'outdoor', 'packaging', 'editorial', 'behind-the-scenes', 'product-shots', 'background']),
  true,
  generate_series(1, 19),
  NULL
ON CONFLICT (client_id, slug) DO NOTHING;

INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id FROM clients LIMIT 1),
  'usage',
  unnest(ARRAY['Website', 'Social organic', 'Social ads', 'Print', 'OOH', 'Banner ads', 'Presentation', 'Pitch', 'Internal', 'Press', 'Blog', 'LinkedIn', 'Newsletter', 'Story', 'Reel']),
  unnest(ARRAY['website', 'social-organic', 'social-ads', 'print', 'ooh', 'banner-ads', 'presentation', 'pitch', 'internal', 'press', 'blog', 'linkedin', 'newsletter', 'story', 'reel']),
  true,
  generate_series(1, 15),
  NULL
ON CONFLICT (client_id, slug) DO NOTHING;

INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order, created_by)
SELECT 
  (SELECT id FROM clients LIMIT 1),
  'visual_style',
  unnest(ARRAY['Minimalistic', 'Colorful', 'Monochrome', 'Pastel', 'High contrast', 'Soft', 'Warm tone', 'Cool tone', 'Corporate', 'Playful', 'Cinematic', 'Documentary', 'Editorial', 'Lifestyle']),
  unnest(ARRAY['minimalistic', 'colorful', 'monochrome', 'pastel', 'high-contrast', 'soft', 'warm-tone', 'cool-tone', 'corporate', 'playful', 'cinematic', 'documentary', 'editorial', 'lifestyle']),
  true,
  generate_series(1, 14),
  NULL
ON CONFLICT (client_id, slug) DO NOTHING;
