#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { Client } from "pg"

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

async function testAssetTagsQuery() {
  if (!DATABASE_URL) {
    console.error("Error: Missing DATABASE_URL or SUPABASE_DB_URL environment variable")
    process.exit(1)
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log("✓ Connected to database\n")

    // Test asset_tags counting for Nørgård Mikkelsen (client_id: 7e3671fa-879e-4313-8832-ef73cf03992b)
    const clientId = '7e3671fa-879e-4313-8832-ef73cf03992b'

    console.log('Testing asset_tags count for client:', clientId)

    // Get all tags for this client
    const tags = await client.query(`
      SELECT id, label, tag_type FROM tags
      WHERE client_id = $1 OR client_id IS NULL
      ORDER BY tag_type, label
    `, [clientId])

    console.log(`\nFound ${tags.rows.length} tags for client ${clientId}:`)
    tags.rows.forEach(tag => {
      console.log(`  - ${tag.label} (${tag.tag_type}) - ID: ${tag.id}`)
    })

    // Test asset_tags count for each tag
    console.log('\nAsset count for each tag:')
    for (const tag of tags.rows) {
      // Method 1: Using inner join (like the current code)
      const count1 = await client.query(`
        SELECT COUNT(*) as count
        FROM asset_tags at
        INNER JOIN assets a ON at.asset_id = a.id
        WHERE at.tag_id = $1 AND a.client_id = $2
      `, [tag.id, clientId])

      // Method 2: Direct count from asset_tags (old method - wrong)
      const count2 = await client.query(`
        SELECT COUNT(*) as count
        FROM asset_tags
        WHERE tag_id = $1
      `, [tag.id])

      console.log(`  ${tag.label}: Inner join=${count1.rows[0].count}, Direct=${count2.rows[0].count}`)
    }

    // Test the exact query from the code
    console.log('\nTesting the exact query from tagging page:')
    const assetTagsQuery = await client.query(`
      SELECT at.tag_id, COUNT(*) as count
      FROM asset_tags at
      INNER JOIN assets a ON at.asset_id = a.id
      WHERE a.client_id = $1
      GROUP BY at.tag_id
    `, [clientId])

    console.log('Asset tags grouped by tag_id:')
    assetTagsQuery.rows.forEach(row => {
      const tag = tags.rows.find(t => t.id === row.tag_id)
      console.log(`  Tag "${tag?.label || 'Unknown'}": ${row.count} assets`)
    })

  } catch (error) {
    console.error("Test failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

testAssetTagsQuery()
