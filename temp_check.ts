#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { Client } from "pg"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function checkStoragePaths() {
  let DATABASE_URL = process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL_NON_POOLING

  if (!DATABASE_URL) {
    console.error("Error: Missing DATABASE_URL")
    process.exit(1)
  }

  // Disable SSL for local testing
  if (DATABASE_URL) {
    DATABASE_URL = DATABASE_URL.replace('sslmode=require', 'sslmode=disable')
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: false,
  })

  try {
    await client.connect()
    console.log("✓ Connected to database\n")

    const result = await client.query(`
      SELECT id, title, storage_path, mime_type, client_id
      FROM assets
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 10
    `)

    console.log('Storage paths for latest 10 assets:')
    result.rows.forEach(asset => {
      console.log(`- "${asset.title}": ${asset.storage_path} (${asset.mime_type})`)
      console.log(`  Client ID: ${asset.client_id}`)
      console.log(`  Asset ID: ${asset.id}`)
      console.log('')
    })

  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

checkStoragePaths()
