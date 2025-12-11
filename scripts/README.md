# Database Migrations

This directory contains SQL migration scripts for the DAM platform database.

## Migration System

The migration system tracks which SQL scripts have been executed to ensure database schema consistency.

### Setup

1. **First, create the migrations tracking table:**
   ```bash
   # Run this SQL in Supabase SQL Editor:
   # scripts/013_create_migrations_table.sql
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Running Migrations

#### Option 1: Automated Execution (Recommended)

To automatically execute pending migrations:

1. **Set up database connection:**
   ```bash
   # Option A: Set DATABASE_URL (full PostgreSQL connection string)
   export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
   
   # Option B: Set Supabase-specific variables
   export SUPABASE_DB_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
   
   # Option C: Use Supabase project URL + password
   export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
   export SUPABASE_DB_PASSWORD="your-db-password"
   ```

2. **Run migrations:**
   ```bash
   npm run migrate:execute
   ```

   This will:
   - Connect to your database
   - Check which migrations have been executed
   - Execute pending migrations in order
   - Record them in the `schema_migrations` table

#### Option 2: Manual Execution

1. **Check migration status:**
   ```bash
   npm run migrate
   ```

2. **Run migrations manually in Supabase SQL Editor:**
   - Open Supabase Dashboard > SQL Editor
   - Copy and execute the SQL from pending migration files
   - After executing, record the migration:

```bash
npm run migrate:record -- <filename>
# Example:
npm run migrate:record -- 014_add_file_type_tags.sql
```

3. **Or manually insert into schema_migrations:**
   ```sql
   INSERT INTO schema_migrations (filename, executed_by)
   VALUES ('014_add_file_type_tags.sql', 'manual');
   ```

### Migration Files

Migrations are numbered sequentially:
- `001_create_tables.sql` - Initial schema
- `002_rls_policies.sql` - Row Level Security policies
- `003_create_profile_trigger.sql` - User profile trigger
- `004_storage_setup.sql` - Storage configuration
- `005_seed_data.sql` - Initial seed data
- `006_create_first_superadmin.sql` - First admin user
- `007_fix_rls_recursion.sql` - RLS recursion fixes
- `008_make_system_tags_global.sql` - System tags accessibility
- `009_storage_buckets_setup.sql` - Storage buckets
- `010_enhance_system.sql` - System enhancements
- `011_make_category_mandatory.sql` - Category requirement
- `012_create_asset_versions.sql` - Asset versions table
- `013_create_migrations_table.sql` - Migration tracking (run first!)
- `014_add_file_type_tags.sql` - File type tags
- `015_auto_assign_file_type_trigger.sql` - Optional trigger for file types
- `016_backfill_file_type_tags.sql` - Backfill existing assets

### Important Notes

- Always run migrations in order (they're numbered)
- The migration system checks for executed migrations but doesn't execute SQL automatically
- SQL must be run manually in Supabase SQL Editor
- After running SQL, use `npm run migrate:record` to mark it as executed
- The `schema_migrations` table tracks execution history

### Troubleshooting

If a migration fails:
1. Check the error message in Supabase SQL Editor
2. Fix any issues in the SQL
3. Re-run the migration
4. Only record it as executed after successful completion

If you need to re-run a migration:
1. Remove the record from `schema_migrations` table
2. Re-run the SQL
3. Record it again

