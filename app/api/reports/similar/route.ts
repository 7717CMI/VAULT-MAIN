import { NextResponse } from "next/server"
import { query } from "@/lib/db"

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "was", "are", "be",
  "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "shall", "can", "this", "that", "these", "those",
  "its", "my", "our", "your", "his", "her", "their", "global", "market",
  "size", "share", "analysis", "growth", "trends", "forecasts", "report",
])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") || ""
  const limitParam = Math.min(10, Math.max(1, Number(searchParams.get("limit")) || 6))

  if (q.length < 2) {
    return NextResponse.json({ reports: [] })
  }

  try {
    const words = q
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

    if (words.length === 0) {
      return NextResponse.json({ reports: [] })
    }

    const conditions = words.map((_, i) => `keyword ILIKE $${i + 1}`)
    const params = words.map((w) => `%${w}%`)

    const sql = `
      SELECT newsid, keyword, catid, forcastyear, reportstatus
      FROM cmi_reports
      WHERE isactive = 1
        AND (${conditions.join(" OR ")})
      ORDER BY
        (${conditions.map((c) => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(" + ")}) DESC,
        reportstatus DESC,
        newsid DESC
      LIMIT $${words.length + 1}
    `
    params.push(String(limitParam))

    const result = await query(sql, params)

    return NextResponse.json({ reports: result.rows })
  } catch (error) {
    console.error("Similar reports error:", error)
    return NextResponse.json({ reports: [] })
  }
}
