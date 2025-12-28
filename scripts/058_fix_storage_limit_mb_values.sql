-- Fix storage_limit_mb values that were incorrectly converted by migration 039
-- Migration 039 divided values by 1024, but storage_limit_mb should remain in MB
-- This migration fixes values that are suspiciously low (< 1000) by converting them back to MB

-- If storage_limit_mb is < 1000, it was likely converted incorrectly by migration 039
-- Convert it back to MB by multiplying by 1024, then set to 10 GB (10240 MB) as default
UPDATE clients
SET storage_limit_mb = 10240 -- 10 GB in MB
WHERE storage_limit_mb > 0 AND storage_limit_mb < 1000;

-- Set any NULL or 0 values to default 10 GB (10240 MB)
UPDATE clients
SET storage_limit_mb = 10240 -- 10 GB in MB
WHERE storage_limit_mb IS NULL OR storage_limit_mb <= 0;

-- Ensure all clients have at least 10 GB (10240 MB) as default
UPDATE clients
SET storage_limit_mb = 10240 -- 10 GB in MB
WHERE storage_limit_mb < 10240;

