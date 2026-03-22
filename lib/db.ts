import { Pool } from "pg"

// Aiven uses self-signed certs — allow them for database connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

let pool: Pool | null = null

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null
  if (!pool) {
    // Append uselibpqcompat to handle Aiven's SSL correctly with pg v8.20+
    let connStr = process.env.DATABASE_URL
    if (!connStr.includes("uselibpqcompat")) {
      connStr += (connStr.includes("?") ? "&" : "?") + "uselibpqcompat=true"
    }
    pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
    })
    pool.on("error", () => {
      pool = null
    })
  }
  return pool
}

export async function query(text: string, params?: unknown[]) {
  const p = getPool()
  if (!p) {
    console.warn("DATABASE_URL not set. Using mock data.")
    return { rows: [] }
  }

  // Retry once on connection failure
  try {
    return await p.query(text, params)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("timeout") || msg.includes("ECONNREFUSED") || msg.includes("terminated")) {
      pool = null
      const p2 = getPool()
      if (p2) return await p2.query(text, params)
    }
    throw error
  }
}

export async function testConnection() {
  const p = getPool()
  if (!p) return { connected: false, error: "DATABASE_URL not set" }

  try {
    const result = await p.query("SELECT NOW() as time, current_database() as db")
    return { connected: true, ...result.rows[0] }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return { connected: false, error: msg }
  }
}

export async function listTables() {
  const p = getPool()
  if (!p) return []

  const result = await p.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  )
  return result.rows.map((r: { table_name: string }) => r.table_name)
}
