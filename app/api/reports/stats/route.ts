import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const totalRes = await query(
      `SELECT COUNT(*) as total FROM cmi_reports WHERE isactive = 1`
    )
    const publishedRes = await query(
      `SELECT COUNT(*) as published FROM cmi_reports WHERE isactive = 1 AND reportstatus = 1`
    )
    const upcomingRes = await query(
      `SELECT COUNT(*) as upcoming FROM cmi_reports WHERE isactive = 1 AND reportstatus = 0`
    )

    return NextResponse.json({
      subscriptionPackage: 250,
      freeCredit: 2,
      totalDownloads: Number(publishedRes.rows[0]?.published || 0),
      remainingCredits: 250,
      totalReports: Number(totalRes.rows[0]?.total || 0),
      publishedReports: Number(publishedRes.rows[0]?.published || 0),
      upcomingReports: Number(upcomingRes.rows[0]?.upcoming || 0),
    })
  } catch (error) {
    console.error("Stats error:", error)
    return NextResponse.json({
      subscriptionPackage: 250,
      freeCredit: 2,
      totalDownloads: 0,
      remainingCredits: 250,
    })
  }
}
