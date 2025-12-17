-- Fix is_superadmin function to use roles instead of system_admins table
-- This unifies the authentication system

CREATE OR REPLACE FUNCTION is_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM client_users cu
    JOIN roles r ON cu.role_id = r.id
    WHERE cu.user_id = p_user_id
    AND r.key = 'superadmin'
    AND cu.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;