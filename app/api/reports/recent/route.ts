import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30))
  const offset = (page - 1) * limit
  const q = searchParams.get("q")?.trim() || ""
  const catId = searchParams.get("catId")

  try {
    let whereClause = "isactive = 1"
    const params: unknown[] = []
    let paramIndex = 1

    if (q.length >= 2) {
      whereClause += ` AND keyword ILIKE $${paramIndex}`
      params.push(`%${q}%`)
      paramIndex++
    }

    if (catId) {
      whereClause += ` AND catid = $${paramIndex}`
      params.push(Number(catId))
      paramIndex++
    }

    const [countRes, result] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM cmi_reports WHERE ${whereClause}`, params),
      query(
        `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
         FROM cmi_reports
         WHERE ${whereClause}
         ORDER BY createddate DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
    ])

    const total = Number(countRes.rows[0]?.total || 0)

    return NextResponse.json({
      reports: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Recent reports error:", error)
    return NextResponse.json({ reports: [], total: 0, page: 1, limit, totalPages: 0 })
  }
}
