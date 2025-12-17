-- Finally drop the system_admins table as it's no longer needed
-- All authentication now uses the roles system with 'superadmin' role

DROP TABLE IF EXISTS system_admins CASCADE;