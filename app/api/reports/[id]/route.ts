import { NextResponse } from "next/server"
import { query } from "@/lib/db"

/** Fix relative image paths to point to coherentmarketinsights.com */
function sanitizeHtml(html: string): string {
  if (!html) return ""
  return html
    // Fix relative image src paths — prepend the base URL
    .replace(
      /(<img[^>]*src=["'])(\.\.\/|\.\/)?(?!https?:\/\/)([^"']+)(["'])/gi,
      '$1https://www.coherentmarketinsights.com/$3$4'
    )
    // Add responsive styling and error handler to all images
    .replace(/<img /gi, '<img style="max-width:100%;height:auto" onerror="this.style.display=\'none\'" ')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const reportId = Number(id)

  try {
    const reportRes = await query(
      `SELECT newsid, reportstatus, catid, newssubject, keyword, forcastyear,
              summary, segmentation, newsdate, price_sul, price_cul, price_multi,
              no_pages, createddate, modifieddate, customname, meta_title
       FROM cmi_reports WHERE newsid = $1`,
      [reportId]
    )

    if (reportRes.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const dynamicRes = await query(
      `SELECT * FROM cmi_report_dynamic WHERE rid = $1 LIMIT 1`,
      [reportId]
    )

    const report = reportRes.rows[0]
    // Sanitize summary HTML
    if (report.summary) {
      report.summary = sanitizeHtml(report.summary)
    }

    const dynamic = dynamicRes.rows[0] || null

    const sections: { title: string; content: string }[] = []
    if (dynamic) {
      for (let i = 1; i <= 20; i++) {
        const field = dynamic[`field_${i}`]
        const disc = dynamic[`disc_${i}`]
        if (field && disc) {
          sections.push({ title: field, content: sanitizeHtml(disc) })
        }
      }
    }

    return NextResponse.json({ report, sections })
  } catch (error) {
    console.error("Report detail error:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}
