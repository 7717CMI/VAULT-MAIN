import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") || ""
  const catId = searchParams.get("catId")
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20))
  const offset = (page - 1) * limit

  if (q.length < 2) {
    return NextResponse.json({ reports: [], total: 0 })
  }

  try {
    const searchTerm = `%${q.trim()}%`

    let whereClauses = `isactive = 1 AND keyword ILIKE $1`
    const countParams: unknown[] = [searchTerm]
    const queryParams: unknown[] = [searchTerm]
    let paramIndex = 2

    if (catId && catId !== "all") {
      whereClauses += ` AND catid = $${paramIndex}`
      countParams.push(Number(catId))
      queryParams.push(Number(catId))
      paramIndex++
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM cmi_reports WHERE ${whereClauses}`,
      countParams
    )
    const total = Number(countResult.rows[0]?.total || 0)

    // Get paginated results
    const sql = `
      SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
      FROM cmi_reports
      WHERE ${whereClauses}
      ORDER BY createddate DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    queryParams.push(limit, offset)

    const result = await query(sql, queryParams)

    return NextResponse.json({
      reports: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Search results error:", error)
    return NextResponse.json({ reports: [], total: 0 })
  }
}
