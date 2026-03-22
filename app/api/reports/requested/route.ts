import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (process.env.DATABASE_URL) {
      const result = await query(
        `SELECT s.reportid as reptid, r.reptitle, s.downdate
         FROM "SubScribc_Users_Stats_new" s
         JOIN "SubScribc_ReportsLists_new" r ON s.reportid = r.reptid
         WHERE s.userid = $1 AND s.ongoingrequested = 1
         ORDER BY s.downdate DESC`,
        [session.uid]
      )
      return NextResponse.json({ reports: result.rows })
    }
  } catch {
    // Fallback
  }

  return NextResponse.json({ reports: [] })
}
