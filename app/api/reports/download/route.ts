import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { findReportPdf, getPresignedDownloadUrl } from "@/lib/s3"

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { reportId, reportTitle, downloadStatus } = await request.json()

  if (!reportId) {
    return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
  }

  try {
    // Update DB records if connected
    if (process.env.DATABASE_URL) {
      await query(
        `UPDATE "SubScribc_uselimit_new" SET "Pending_down" = "Pending_down" - 1 WHERE gid = 1`
      )
      await query(
        `UPDATE "SubScribc_Users_new" SET no_of_down = no_of_down + 1 WHERE userid = $1`,
        [session.uid]
      )
      await query(
        `INSERT INTO "SubScribc_Users_Stats_new" (userid, reportid, downdate, reportstatus, ongoingrequested, downloaded)
         VALUES ($1, $2, NOW(), $3, $4, $5)`,
        [
          session.uid,
          reportId,
          downloadStatus,
          downloadStatus === 0 ? 1 : 0,
          downloadStatus === 1 ? 1 : 0,
        ]
      )
    }

    // For published reports, fetch from S3
    if (downloadStatus === 1 && process.env.AWS_ACCESS_KEY_ID && reportTitle) {
      const s3Key = await findReportPdf(reportTitle)
      if (s3Key) {
        const downloadUrl = await getPresignedDownloadUrl(s3Key)
        return NextResponse.json({
          success: true,
          downloadUrl,
          message: "Report ready for download.",
        })
      }
      return NextResponse.json({
        success: true,
        message: "Report PDF not found in storage. Our team has been notified.",
      })
    }

    // For ongoing/upcoming reports
    if (downloadStatus === 0) {
      return NextResponse.json({
        success: true,
        message: "Request sent. You will be notified when the report is ready.",
      })
    }

    return NextResponse.json({
      success: true,
      message: "Download request recorded.",
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json(
      { error: "Failed to process download" },
      { status: 500 }
    )
  }
}
