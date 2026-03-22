import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getAvailablePdfKeywords } from "@/lib/s3"

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

    // Get available PDF keywords from S3
    let pdfKeywords: Set<string> = new Set()
    try {
      pdfKeywords = await getAvailablePdfKeywords()
    } catch {
      // If S3 fails, show all reports
    }

    // Fetch all matching reports, then filter by PDF availability
    const result = await query(
      `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
       FROM cmi_reports
       WHERE ${whereClause}
       ORDER BY createddate DESC`,
      params
    )

    let filteredRows = result.rows
    if (pdfKeywords.size > 0) {
      filteredRows = filteredRows.filter((r: { keyword: string }) => pdfKeywords.has(r.keyword))
    }

    const total = filteredRows.length
    const paginatedRows = filteredRows.slice(offset, offset + limit)

    return NextResponse.json({
      reports: paginatedRows,
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
