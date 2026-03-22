import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { findReportPdf, getPresignedDownloadUrl } from "@/lib/s3"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const reportId = Number(id)

  try {
    const reportRes = await query(
      `SELECT newsid, keyword, reportstatus FROM cmi_reports WHERE newsid = $1`,
      [reportId]
    )

    if (reportRes.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const report = reportRes.rows[0]
    const keyword = report.keyword || ""

    // Try local PDF first (by keyword name)
    const localPath = join(process.cwd(), "public", "pdffiles", `${keyword}.pdf`)
    if (existsSync(localPath)) {
      const pdfBuffer = await readFile(localPath)
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${keyword}.pdf"`,
        },
      })
    }

    // Try S3
    if (process.env.AWS_ACCESS_KEY_ID) {
      const s3Key = await findReportPdf(keyword)
      if (s3Key) {
        const presignedUrl = await getPresignedDownloadUrl(s3Key)
        const s3Res = await fetch(presignedUrl)
        if (s3Res.ok) {
          const pdfBuffer = await s3Res.arrayBuffer()
          return new NextResponse(pdfBuffer, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${keyword}.pdf"`,
            },
          })
        }
      }
    }

    // No PDF found — return JSON so the viewer can show the HTML content instead
    return NextResponse.json({ noPdf: true }, { status: 200 })
  } catch (error) {
    console.error("View report error:", error)
    return NextResponse.json({ error: "Failed to load PDF" }, { status: 500 })
  }
}
