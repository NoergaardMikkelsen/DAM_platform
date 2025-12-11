#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { createClient } from "@supabase/supabase-js"
import { readdir, readFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing required environment variables")
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface Migration {
  filename: string
  content: string
  checksum: string
}

async function getExecutedMigrations(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase.from("schema_migrations").select("filename")

    if (error) {
      // If table doesn't exist, return empty set
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return new Set()
      }
      throw error
    }

    return new Set(data?.map((m) => m.filename) || [])
  } catch (error: any) {
    // If table doesn't exist, return empty set
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
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

async function recordMigration(migration: Migration): Promise<void> {
  const { error } = await supabase.from("schema_migrations").insert({
    filename: migration.filename,
    checksum: migration.checksum,
    executed_by: "migration_runner",
  })

  if (error) {
    // If it's a duplicate, that's okay
    if (error.code !== "23505") {
      throw error
    }
  }
}

async function runMigrations() {
  try {
    console.log("Starting migration process...\n")

    // Check if migrations table exists
    const executedMigrations = await getExecutedMigrations()
    const allMigrations = await readMigrationFiles()

    // If migrations table doesn't exist, we need to create it first
    // The 013 migration should create it, but we need to handle the case where it doesn't exist yet
    const migrationsTableExists = executedMigrations.size >= 0 || allMigrations.some((m) => m.filename === "013_create_migrations_table.sql")

    const pendingMigrations = allMigrations.filter((m) => !executedMigrations.has(m.filename))

    if (pendingMigrations.length === 0) {
      console.log("✓ All migrations are up to date!")
      return
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s):\n`)
    console.log("NOTE: This script checks migration status but cannot execute SQL directly.")
    console.log("Please run the following migrations manually in Supabase SQL Editor:\n")

    for (const migration of pendingMigrations) {
      console.log(`\n--- Migration: ${migration.filename} ---`)
      console.log("Status: PENDING")
      console.log(`File: scripts/${migration.filename}`)
      console.log(`Checksum: ${migration.checksum.substring(0, 8)}...`)
      console.log("\nAfter executing this migration, run this script again to mark it as executed.")
    }

    console.log("\n\nTo mark migrations as executed after running them manually:")
    console.log("1. Execute the SQL files in Supabase SQL Editor")
    console.log("2. Run this script again - it will detect completed migrations")
    console.log("3. Or manually insert into schema_migrations table")

    // Try to record migrations that might have been executed
    // This is a best-effort approach
    console.log("\n\nAttempting to verify migration status...")

    for (const migration of pendingMigrations) {
      // Check if the migration's effects are already in place
      // This is a simple heuristic - in practice, you'd check for specific tables/columns
      try {
        // For now, we'll just inform the user
        console.log(`\nTo execute ${migration.filename}:`)
        console.log(`1. Open Supabase Dashboard > SQL Editor`)
        console.log(`2. Copy contents of scripts/${migration.filename}`)
        console.log(`3. Execute the SQL`)
        console.log(`4. Run: npm run migrate:record -- ${migration.filename}`)
      } catch (error) {
        console.error(`Error checking ${migration.filename}:`, error)
      }
    }
  } catch (error) {
    console.error("\n✗ Migration check failed:", error)
    process.exit(1)
  }
}

// Run migrations
runMigrations()

