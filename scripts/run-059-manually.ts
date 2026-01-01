#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { Client } from "pg"
import { readFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

// Get database connection from environment
const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  (process.env.POSTGRES_HOST && process.env.POSTGRES_PASSWORD
    ? `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:5432/${process.env.POSTGRES_DATABASE || "postgres"}?sslmode=require`
    : process.env.SUPABASE_DB_PASSWORD && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@${process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")}.supabase.co:5432/postgres`
    : null)

if (!DATABASE_URL) {
  console.error("Error: Missing DATABASE_URL or SUPABASE_DB_URL environment variable")
  process.exit(1)
}

function calculateChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

async function runMigration059() {
  // Parse connection string to handle SSL properly
  let connectionString = DATABASE_URL || ""
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '')
  
  const connectionConfig: any = {
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  }
  
  const client = new Client(connectionConfig)

  try {
    await client.connect()
    console.log("✓ Connected to database\n")

    // Read migration 059
    const filePath = join(process.cwd(), "scripts", "059_update_rls_policies_from_permission_matrix.sql")
    const content = await readFile(filePath, "utf-8")
    const checksum = calculateChecksum(content)

    console.log("▶ Executing: 059_update_rls_policies_from_permission_matrix.sql")
    console.log("=" .repeat(60))

    // Execute the SQL
    await client.query(content)

    // Record migration execution (update if exists, insert if not)
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, executed_by, executed_at) 
       VALUES ($1, $2, $3, now()) 
       ON CONFLICT (filename) 
       DO UPDATE SET checksum = EXCLUDED.checksum, executed_at = now(), executed_by = EXCLUDED.executed_by`,
      ["059_update_rls_policies_from_permission_matrix.sql", checksum, "manual_rerun"],
    )

    console.log("✓ Completed: 059_update_rls_policies_from_permission_matrix.sql")
    console.log("=" .repeat(60))
    console.log("✓ Migration executed and recorded successfully!")
  } catch (error: any) {
    console.error("\n✗ Migration failed:", error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration059()

