-- Update users RLS policies to allow superadmins to see all users in system

-- Drop existing policies
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

-- Users can see their own profile OR superadmins can see all users
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.user_id = auth.uid()
    AND cu.status = 'active'
    AND r.key = 'superadmin'
  )
);

-- Users can only update their own profile
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated
USING (id = auth.uid());
