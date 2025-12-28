#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { Client } from "pg"
import { readdir, readFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

// Get database connection from environment
// Try multiple environment variable formats
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
  console.error("\nTo run migrations, set one of:")
  console.error("  - DATABASE_URL (PostgreSQL connection string)")
  console.error("  - SUPABASE_DB_URL (Supabase database URL)")
  console.error("  - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD")
  console.error("\nExample:")
  console.error('  DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"')
  process.exit(1)
}

interface Migration {
  filename: string
  content: string
  checksum: string
}

async function getExecutedMigrations(client: Client): Promise<Set<string>> {
  try {
    const result = await client.query("SELECT filename FROM schema_migrations")
    return new Set(result.rows.map((row) => row.filename))
  } catch (error: any) {
    // If table doesn't exist, return empty set
    if (error.code === "42P01") {
      return new Set()
    }
    throw error
  }
}

function calculateChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

async function readMigrationFiles(): Promise<Migration[]> {
  const scriptsDir = join(process.cwd(), "scripts")
  const files = await readdir(scriptsDir)

  // Filter SQL files and sort by number prefix
  const sqlFiles = files
    .filter((f) => f.endsWith(".sql") && f !== "README.md")
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || "0")
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || "0")
      return numA - numB
    })

  const migrations: Migration[] = []

  for (const filename of sqlFiles) {
    const filePath = join(scriptsDir, filename)
    const content = await readFile(filePath, "utf-8")
    const checksum = calculateChecksum(content)
    migrations.push({ filename, content, checksum })
  }

  return migrations
}

async function executeMigration(client: Client, migration: Migration): Promise<void> {
  console.log(`\n▶ Executing: ${migration.filename}`)

  try {
    // Execute the SQL
    await client.query(migration.content)

    // Record migration execution
    await client.query(
      "INSERT INTO schema_migrations (filename, checksum, executed_by) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING",
      [migration.filename, migration.checksum, "migration_execute"],
    )

    console.log(`✓ Completed: ${migration.filename}`)
  } catch (error: any) {
    // Handle "already exists" errors gracefully - these mean the migration was already applied
    const alreadyExistsErrors = [
      "42701", // duplicate_column
      "42P07", // duplicate_table
      "42710", // duplicate_object
      "42P16", // duplicate_schema
    ]
    
    if (alreadyExistsErrors.includes(error.code)) {
      console.log(`⚠ Skipped: ${migration.filename} (already applied)`)
      // Still record it as executed
      try {
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum, executed_by) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING",
          [migration.filename, migration.checksum, "migration_execute"],
        )
      } catch (recordError) {
        // Ignore errors when recording - migration might already be recorded
      }
      return
    }
    
    console.error(`✗ Failed: ${migration.filename}`)
    console.error(`  Error: ${error.message}`)
    throw error
  }
}

async function runMigrations() {
  // Parse connection string to handle SSL properly
  let connectionString = DATABASE_URL || ""
  
  // Remove sslmode from connection string if present (we'll use SSL object instead)
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '')
  
  // Always apply SSL config to handle self-signed certificates
  const connectionConfig: any = {
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Allow self-signed certificates
    },
  }
  
  const client = new Client(connectionConfig)

  try {
    await client.connect()
    console.log("✓ Connected to database\n")

    // Check if migrations table exists
    let executedMigrations: Set<string>
    try {
      executedMigrations = await getExecutedMigrations(client)
    } catch (error: any) {
      if (error.code === "42P01") {
        console.log("⚠ Migrations table doesn't exist yet.")
        console.log("  The first migration (013_create_migrations_table.sql) will create it.\n")
        executedMigrations = new Set()
      } else {
        throw error
      }
    }

    const allMigrations = await readMigrationFiles()
    const pendingMigrations = allMigrations.filter((m) => !executedMigrations.has(m.filename))

    if (pendingMigrations.length === 0) {
      console.log("✓ All migrations are up to date!")
      return
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s):`)
    for (const m of pendingMigrations) {
      console.log(`  - ${m.filename}`)
    }

    console.log("\n" + "=".repeat(60))
    console.log("Starting migration execution...")
    console.log("=".repeat(60))

    for (const migration of pendingMigrations) {
      await executeMigration(client, migration)
    }

    console.log("\n" + "=".repeat(60))
    console.log("✓ All migrations completed successfully!")
    console.log("=".repeat(60))
  } catch (error) {
    console.error("\n✗ Migration failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run migrations
runMigrations()

