import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") || ""
  const catId = searchParams.get("catId")

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const cleanQuery = q.replace(/global/gi, "").replace(/market/gi, "").trim()

    let sql = `SELECT newsid, keyword FROM cmi_reports WHERE isactive = 1 AND keyword ILIKE $1`
    const params: unknown[] = [`%${cleanQuery}%`]

    if (catId && catId !== "all") {
      sql += ` AND catid = $2`
      params.push(Number(catId))
    }

    sql += ` ORDER BY createddate DESC LIMIT 10`

    const result = await query(sql, params)
    return NextResponse.json({
      suggestions: result.rows.map((r: { newsid: number; keyword: string }) => ({
        newsid: r.newsid,
        keyword: r.keyword,
      })),
    })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}
