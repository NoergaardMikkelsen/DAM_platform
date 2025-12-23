-- Check assets before deletion - safety check
-- This shows what will be deleted

-- Count assets per client
SELECT 
    c.name as client_name,
    c.id as client_id,
    COUNT(a.id) as asset_count,
    SUM(a.file_size) as total_size_bytes,
    ROUND(SUM(a.file_size)::numeric / 1024 / 1024, 2) as total_size_mb
FROM clients c
LEFT JOIN assets a ON a.client_id = c.id
GROUP BY c.id, c.name
ORDER BY asset_count DESC;

-- List all clients
SELECT id, name, created_at FROM clients ORDER BY name;

