import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const catId = searchParams.get("catId")
  const limit = Math.min(Number(searchParams.get("limit") || 12), 50)

  try {
    const catFilter = catId ? `AND catid = $1` : ""
    const params: unknown[] = catId ? [Number(catId)] : []

    // Trending = most recent published reports (reportstatus = 1)
    const trendingRes = await query(
      `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
       FROM cmi_reports
       WHERE isactive = 1 AND reportstatus = 1 ${catFilter}
       ORDER BY createddate DESC
       LIMIT ${limit}`,
      params
    )

    // Upcoming = reportstatus 0, most recent
    const upcomingRes = await query(
      `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
       FROM cmi_reports
       WHERE isactive = 1 AND reportstatus = 0 ${catFilter}
       ORDER BY createddate DESC
       LIMIT ${limit}`,
      params
    )

    // To Be Published = reportstatus 0, random selection
    const toBePublishedRes = await query(
      `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
       FROM cmi_reports
       WHERE isactive = 1 AND reportstatus = 0 ${catFilter}
       ORDER BY RANDOM()
       LIMIT 10`,
      params
    )

    return NextResponse.json({
      trending: trendingRes.rows,
      upcoming: upcomingRes.rows,
      toBePublished: toBePublishedRes.rows,
    })
  } catch (error) {
    console.error("Category reports error:", error)
    return NextResponse.json({ trending: [], upcoming: [], toBePublished: [] })
  }
}
