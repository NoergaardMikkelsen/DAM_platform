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

async function checkTenantMapping() {
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

    console.log('=== CLIENT SLUG MAPPING ===')
    const clients = await client.query('SELECT id, name, slug FROM clients ORDER BY name')
    clients.rows.forEach(c => {
      console.log(`  ${c.name}: slug='${c.slug}' id='${c.id}'`)
    })

    console.log('\n=== USER ACCESS MAPPING ===')
    const userId = 'fd53f803-d313-452e-a925-a70d79aae125'
    const userAccess = await client.query(`
      SELECT cu.client_id, c.name, c.slug, r.key as role
      FROM client_users cu
      JOIN clients c ON cu.client_id = c.id
      JOIN roles r ON cu.role_id = r.id
      WHERE cu.user_id = $1 AND cu.status = 'active'
    `, [userId])

    console.log(`User ${userId} has access to:`)
    userAccess.rows.forEach(access => {
      console.log(`  - ${access.name} (${access.slug}) as ${access.role}`)
      console.log(`    URL would be: ${access.slug}.brandassets.space`)
    })

  } catch (error) {
    console.error("Check failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

checkTenantMapping()
