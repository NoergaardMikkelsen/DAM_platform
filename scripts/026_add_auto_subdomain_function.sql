-- AUTO SUBDOMAIN GENERATION FUNCTION
-- Automatically generates subdomain for new clients

CREATE OR REPLACE FUNCTION generate_client_subdomain(client_slug TEXT)
RETURNS TEXT AS $$
DECLARE
  base_domain TEXT;
BEGIN
  -- Get base domain from system settings
  SELECT value INTO base_domain
  FROM system_settings
  WHERE key = 'base_domain'
  LIMIT 1;

  -- If no base domain is set, use default
  IF base_domain IS NULL THEN
    base_domain := 'brandassets.space';
  END IF;

  -- Return subdomain
  RETURN client_slug || '.' || base_domain;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-set domain on client insert
CREATE OR REPLACE FUNCTION set_client_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- Always generate domain from slug for consistency
  -- This ensures domain is always slug.brandassets.space
  NEW.domain := generate_client_subdomain(NEW.slug);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on clients table
DROP TRIGGER IF EXISTS set_client_domain_trigger ON clients;
CREATE TRIGGER set_client_domain_trigger
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_client_domain();
