-- Create the first superadmin user
-- This assumes you'll sign up through the Supabase Auth UI first
-- Replace 'your-email@example.com' with your actual email

-- After you sign up through the app, run this to make yourself a superadmin:
-- UPDATE users 
-- SET role = 'superadmin'
-- WHERE email = 'your-email@example.com';

-- Or create a client and assign yourself to it:
-- First, get your user_id from auth.users:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Create a client:
INSERT INTO clients (name, slug, domain, status, primary_color, secondary_color)
VALUES ('Nørgård Mikkelsen', 'norgard-mikkelsen', 'nmic.dk', 'active', '#D35D6E', '#8B5A8E')
RETURNING id;

-- Then assign your user to this client as superadmin:
-- Replace 'your-user-id' with the id from auth.users and 'client-id' with the id from the INSERT above
-- INSERT INTO client_users (client_id, user_id, role_id, status)
-- VALUES ('client-id', 'your-user-id', (SELECT id FROM roles WHERE key = 'superadmin'), 'active');
