#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { Client } from "pg"
import { readFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  (process.env.POSTGRES_HOST && process.env.POSTGRES_PASSWORD
    ? `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:5432/${process.env.POSTGRES_DATABASE || "postgres"}?sslmode=require`
    : null)

if (!DATABASE_URL) {
  console.error("Error: Missing database connection")
  process.exit(1)
}

async function runMigration(filename: string) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    await client.connect()
    console.log(`\n▶ Executing: ${filename}`)

    const filePath = join(process.cwd(), "scripts", filename)
    const content = await readFile(filePath, "utf-8")
    const checksum = createHash("sha256").update(content).digest("hex")

    // Execute the SQL
    await client.query(content)

    // Record migration execution
    await client.query(
      "INSERT INTO schema_migrations (filename, checksum, executed_by) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING",
      [filename, checksum, "migration_execute"],
    )

    console.log(`✓ Completed: ${filename}`)
  } catch (error: any) {
    console.error(`✗ Failed: ${filename}`)
    console.error(`  Error: ${error.message}`)
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const migrations = [
    "013_create_migrations_table.sql",
    "014_add_file_type_tags.sql",
    "015_auto_assign_file_type_trigger.sql",
    "016_backfill_file_type_tags.sql",
  ]

  console.log("Running new migrations...\n")

  for (const migration of migrations) {
    await runMigration(migration)
  }

  console.log("\n✓ All new migrations completed!")
}

main().catch((error) => {
  console.error("\n✗ Migration failed:", error)
  process.exit(1)
})

