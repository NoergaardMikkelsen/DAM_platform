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

async function testAssetsQuery() {
  if (!DATABASE_URL) {
    console.error("Error: Missing DATABASE_URL or SUPABASE_DB_URL environment variable")
    process.exit(1)
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : false,
  })

  try {
    await client.connect()
    console.log("✓ Connected to database\n")

    // Test the exact query that assets page uses
    const userId = 'fd53f803-d313-452e-a925-a70d79aae125' // sarah.english@nmic.dk

    console.log('Testing client_users query for user:', userId)
    const clientUsers = await client.query(
      'SELECT client_id FROM client_users WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    )

    console.log('Client user relationships found:', clientUsers.rows.length)
    clientUsers.rows.forEach(row => console.log('  Client ID:', row.client_id))

    const clientIds = clientUsers.rows.map(row => row.client_id)
    console.log('Client IDs array:', clientIds)

    if (clientIds.length > 0) {
      console.log('\nTesting assets query with client IDs:', clientIds)
      const assets = await client.query(
        'SELECT COUNT(*) as count FROM assets WHERE client_id = ANY($1) AND status = $2',
        [clientIds, 'active']
      )
      console.log('Assets found:', assets.rows[0].count)

      // Also show some asset details
      const assetDetails = await client.query(`
        SELECT a.id, a.title, c.name as client_name
        FROM assets a
        JOIN clients c ON a.client_id = c.id
        WHERE a.client_id = ANY($1) AND a.status = $2
        ORDER BY a.created_at DESC
        LIMIT 5
      `, [clientIds, 'active'])

      console.log('\nAsset details:')
      assetDetails.rows.forEach(asset => {
        console.log(`  - "${asset.title}" in ${asset.client_name}`)
      })
    } else {
      console.log('\nNo client IDs found - user has no tenant access')
    }

  } catch (error) {
    console.error("Test failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

testAssetsQuery()
