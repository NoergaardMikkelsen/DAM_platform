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

async function runMigration() {
  const connectionConfig: any = {
    connectionString: DATABASE_URL as string,
  }

  // Add SSL configuration
  connectionConfig.ssl = {
    rejectUnauthorized: false, // Disable SSL verification for development
  }

  const client = new Client(connectionConfig)

  try {
    await client.connect()
    console.log("Connected to database")

    const filename = "023_create_system_admins.sql"
    const filePath = join(process.cwd(), "scripts", filename)
    const content = await readFile(filePath, "utf-8")
    const checksum = createHash("sha256").update(content).digest("hex")

    console.log(`\n▶ Executing: ${filename}`)

    // Execute the SQL
    await client.query(content)

    // Record migration execution
    await client.query(
      "INSERT INTO schema_migrations (filename, checksum, executed_by) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING",
      [filename, checksum, "temp-migration-runner"],
    )

    console.log(`✓ Completed: ${filename}`)
    console.log("\n✓ System admins table migration completed successfully!")

  } catch (error: any) {
    console.error(`✗ Migration failed: ${error.message}`)
    throw error
  } finally {
    await client.end()
  }
}

runMigration().catch((error) => {
  console.error("\n✗ Migration script failed:", error)
  process.exit(1)
})

