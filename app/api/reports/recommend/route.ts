import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") || ""

  try {
    const result = await query(
      `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
       FROM cmi_reports
       WHERE isactive = 1 AND keyword ILIKE $1
       ORDER BY createddate DESC
       LIMIT 9`,
      [`%${q}%`]
    )

    return NextResponse.json({ reports: result.rows })
  } catch (error) {
    console.error("Recommend error:", error)
    return NextResponse.json({ reports: [] })
  }
}
