-- Convert storage_limit_mb from MB to GB values
-- Existing clients have 10000 MB, which should become 10 GB

UPDATE clients
SET storage_limit_mb = storage_limit_mb / 1024
WHERE storage_limit_mb >= 1024; -- Only convert values that look like MB (1024+)

-- Reset any invalid values to 10 GB default
UPDATE clients
SET storage_limit_mb = 10
WHERE storage_limit_mb <= 0 OR storage_limit_mb IS NULL;
