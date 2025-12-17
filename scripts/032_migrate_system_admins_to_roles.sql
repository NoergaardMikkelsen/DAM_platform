-- Migrate existing system_admins to superadmin roles on all clients
-- This ensures existing system admins maintain their access

INSERT INTO client_users (client_id, user_id, role_id, status)
SELECT
  c.id as client_id,
  sa.id as user_id,
  r.id as role_id,
  'active' as status
FROM system_admins sa
CROSS JOIN clients c
JOIN roles r ON r.key = 'superadmin'
WHERE NOT EXISTS (
  SELECT 1 FROM client_users cu
  WHERE cu.user_id = sa.id AND cu.client_id = c.id
)
ON CONFLICT (client_id, user_id) DO NOTHING;