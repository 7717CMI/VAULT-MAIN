import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getAvailablePdfKeywords } from "@/lib/s3"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const catId = searchParams.get("catId")
  const limit = Math.min(Number(searchParams.get("limit") || 12), 50)

  try {
    const catFilter = catId ? `AND catid = $1` : ""
    const params: unknown[] = catId ? [Number(catId)] : []

    // Get available PDF keywords from S3 to filter trending reports
    let pdfKeywords: Set<string> = new Set()
    try {
      pdfKeywords = await getAvailablePdfKeywords()
    } catch {
      // If S3 fails, show all published reports
    }

    // Trending = most recent published reports (reportstatus = 1)
    // Fetch more than needed so we can filter by PDF availability
    const trendingFetchLimit = pdfKeywords.size > 0 ? limit * 5 : limit
    const trendingRes = await query(
      `SELECT newsid, keyword, catid, forcastyear, createddate, reportstatus
       FROM cmi_reports
       WHERE isactive = 1 AND reportstatus = 1 ${catFilter}
       ORDER BY createddate DESC
       LIMIT ${trendingFetchLimit}`,
      params
    )

    // Filter to only reports that have PDFs in S3
    if (pdfKeywords.size > 0) {
      trendingRes.rows = trendingRes.rows
        .filter((r: { keyword: string }) => pdfKeywords.has(r.keyword))
        .slice(0, limit)
    }

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
