-- UPDATE CLIENT DOMAINS
-- Set domain for existing clients based on their slug and the base domain

UPDATE clients
SET domain = generate_client_subdomain(slug)
WHERE status = 'active';
