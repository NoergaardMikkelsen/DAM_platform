#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js"
import { readFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing required environment variables")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function calculateChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

async function recordMigration(filename: string) {
  try {
    const filePath = join(process.cwd(), "scripts", filename)
    const content = await readFile(filePath, "utf-8")
    const checksum = calculateChecksum(content)

    const { error } = await supabase.from("schema_migrations").insert({
      filename,
      checksum,
      executed_by: "manual",
    })

    if (error) {
      if (error.code === "23505") {
        console.log(`Migration ${filename} is already recorded.`)
      } else {
        throw error
      }
    } else {
      console.log(`✓ Recorded migration: ${filename}`)
    }
  } catch (error) {
    console.error(`Error recording migration ${filename}:`, error)
    process.exit(1)
  }
}

const filename = process.argv[2]
if (!filename) {
  console.error("Usage: npm run migrate:record -- <filename>")
  console.error("Example: npm run migrate:record -- 013_create_migrations_table.sql")
  process.exit(1)
}

recordMigration(filename)

