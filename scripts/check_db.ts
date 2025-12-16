#!/usr/bin/env node

import { config } from "dotenv"
import { resolve } from "path"
import { Client } from "pg"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

// Get database connection from environment
let DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  (process.env.POSTGRES_HOST && process.env.POSTGRES_PASSWORD
    ? `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:5432/${process.env.POSTGRES_DATABASE || "postgres"}?sslmode=require`
    : process.env.SUPABASE_DB_PASSWORD && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@${process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")}.supabase.co:5432/postgres`
    : null)

// Disable SSL for local testing
if (DATABASE_URL) {
  DATABASE_URL = DATABASE_URL.replace('sslmode=require', 'sslmode=disable')
}

async function checkDatabase() {
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

    // Check clients
    console.log("=== CLIENTS ===")
    const clientsResult = await client.query("SELECT id, name, slug, status FROM clients ORDER BY name")
    console.log(`Found ${clientsResult.rows.length} clients:`)
    clientsResult.rows.forEach((client: any) => {
      console.log(`  - ${client.name} (${client.slug}) - ${client.status}`)
    })

    // Check users
    console.log("\n=== USERS ===")
    const usersResult = await client.query("SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5")
    console.log(`Found ${usersResult.rows.length} users (showing latest 5):`)
    usersResult.rows.forEach((user: any) => {
      console.log(`  - ${user.email} (${user.id}) - ${user.created_at}`)
    })

    // Check system admins
    console.log("\n=== SYSTEM ADMINS ===")
    const systemAdminsResult = await client.query("SELECT id FROM system_admins")
    console.log(`Found ${systemAdminsResult.rows.length} system admins:`)
    systemAdminsResult.rows.forEach((admin: any) => {
      console.log(`  - ${admin.id}`)
    })

    // Check client_users
    console.log("\n=== CLIENT USERS ===")
    const clientUsersResult = await client.query(`
      SELECT cu.user_id, cu.client_id, c.name as client_name, r.key as role_key
      FROM client_users cu
      JOIN clients c ON cu.client_id = c.id
      JOIN roles r ON cu.role_id = r.id
      WHERE cu.status = 'active'
      ORDER BY c.name, cu.user_id
    `)
    console.log(`Found ${clientUsersResult.rows.length} active client user relationships:`)
    clientUsersResult.rows.forEach((cu: any) => {
      console.log(`  - User ${cu.user_id} → ${cu.client_name} (${cu.role_key})`)
    })

    // Check assets
    console.log("\n=== ASSETS ===")
    const assetsResult = await client.query(`
      SELECT a.id, a.title, a.client_id, c.name as client_name, a.status
      FROM assets a
      JOIN clients c ON a.client_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `)
    console.log(`Found ${assetsResult.rows.length} assets (showing latest 10):`)
    assetsResult.rows.forEach((asset: any) => {
      console.log(`  - "${asset.title}" in ${asset.client_name} (${asset.status})`)
    })

    // Check roles
    console.log("\n=== ROLES ===")
    const rolesResult = await client.query("SELECT id, key, name FROM roles ORDER BY key")
    console.log(`Found ${rolesResult.rows.length} roles:`)
    rolesResult.rows.forEach((role: any) => {
      console.log(`  - ${role.key}: ${role.name}`)
    })

  } catch (error) {
    console.error("Database check failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

checkDatabase()
