import { NextResponse } from "next/server"
import { testConnection, listTables, query } from "@/lib/db"

export async function GET() {
  try {
    // 1. Test connection
    const conn = await testConnection()
    if (!conn.connected) {
      return NextResponse.json({ success: false, ...conn }, { status: 500 })
    }

    // 2. List all tables
    const tables = await listTables()

    // 3. Sample rows from each table (first 3 rows)
    const tableSamples: Record<string, { columns: string[]; rowCount: number; sample: unknown[] }> = {}
    for (const table of tables) {
      try {
        const countRes = await query(`SELECT COUNT(*) as count FROM "${table}"`)
        const sampleRes = await query(`SELECT * FROM "${table}" LIMIT 3`)
        tableSamples[table] = {
          columns: sampleRes.rows.length > 0 ? Object.keys(sampleRes.rows[0]) : [],
          rowCount: Number(countRes.rows[0]?.count || 0),
          sample: sampleRes.rows,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error"
        tableSamples[table] = { columns: [], rowCount: 0, sample: [{ error: msg }] }
      }
    }

    return NextResponse.json({
      success: true,
      connection: conn,
      tableCount: tables.length,
      tables: tableSamples,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
