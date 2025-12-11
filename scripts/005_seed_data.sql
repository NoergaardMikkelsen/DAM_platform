-- Seed initial data for testing

-- Insert a test client
INSERT INTO clients (id, name, slug, domain, status, primary_color, secondary_color, storage_limit_mb)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'NMIC Demo',
  'nmic-demo',
  'nmic-demo.damsystem.com',
  'active',
  '#DF475C',
  '#6c757d',
  10000
)
ON CONFLICT (id) DO NOTHING;

-- Insert default system tags for the client
INSERT INTO tags (client_id, tag_type, label, slug, is_system, sort_order)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'category', 'Campaign', 'campaign', true, 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'category', 'Employee', 'employee', true, 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'category', 'Products', 'products', true, 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'description', 'Summer', 'summer', true, 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'description', 'Winter', 'winter', true, 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'description', 'Christmas', 'christmas', true, 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'usage', 'Website', 'website', true, 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'usage', 'Social ads', 'social-ads', true, 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'usage', 'Soft', 'soft', true, 3)
ON CONFLICT DO NOTHING;
