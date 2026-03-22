"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Eye, BarChart3, Building2, FileText, ShieldCheck, Users, Timer, Target, Award, BookOpen, Quote } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SectionHeader } from "@/components/section-header"
import { getCategoryName } from "@/lib/data"
import { CLIENT_LOGOS } from "@/lib/clients"
import { TESTIMONIALS } from "@/lib/testimonials"

interface ReportData {
  newsid: number
  reportstatus: number | null
  catid: number
  newssubject: string
  keyword: string
  forcastyear: string
  summary: string | null
  newsdate: string
  price_sul: number
  price_cul: number
  price_multi: number
  no_pages: number | null
  createddate: string
  customname: string
}

interface Section {
  title: string
  content: string
}

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<ReportData | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [latestReports, setLatestReports] = useState<{ newsid: number; keyword: string; createddate: string }[]>([])

  useEffect(() => {
    async function fetchReport() {
      setLoading(true)
      try {
        const res = await fetch(`/api/reports/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setReport(data.report || null)
          setSections(data.sections || [])
        }
      } catch {
        // error
      } finally {
        setLoading(false)
      }
    }

    async function fetchLatest() {
      try {
        const res = await fetch("/api/reports/recent?limit=6")
        if (res.ok) {
          const data = await res.json()
          setLatestReports(data.reports || [])
        }
      } catch { /* ignore */ }
    }

    fetchReport()
    fetchLatest()
  }, [params.id])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-8">
        <div className="text-center">
          <SectionHeader title="Report Not Found" description="The requested report could not be found." />
          <Button onClick={() => router.back()} className="mt-6">
            <ArrowLeft className="mr-2 size-4" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  const catName = getCategoryName(report.catid)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
      {/* Report content styles */}
      <style jsx global>{`
        .report-content {
          font-size: 14px;
          line-height: 1.75;
          color: var(--muted-foreground);
        }
        .report-content p {
          margin-bottom: 12px;
        }
        .report-content strong, .report-content b {
          color: var(--foreground);
          font-weight: 600;
        }
        .report-content ul, .report-content ol {
          margin: 8px 0 12px 20px;
          padding: 0;
        }
        .report-content li {
          margin-bottom: 6px;
        }
        .report-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13px;
        }
        .report-content table td,
        .report-content table th {
          border: 1px solid var(--border);
          padding: 10px 14px;
          vertical-align: top;
          text-align: left;
        }
        .report-content table tr:first-child td,
        .report-content table th {
          background: var(--secondary);
          font-weight: 600;
          color: var(--foreground);
        }
        .report-content table tr:nth-child(even) {
          background: var(--secondary);
        }
        .report-content .tblcolBG {
          background: var(--secondary);
          font-weight: 600;
          color: var(--foreground);
        }
        .report-content .marketReptable {
          margin: 20px 0;
        }
        .report-content .market_tabhead h4 {
          font-size: 15px;
          font-weight: 700;
          color: var(--foreground);
          margin: 12px 0;
        }
        .report-content .market_tblimg { display: none; }
        .report-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 8px auto;
          display: block;
        }
        .report-content a {
          color: var(--accent);
          text-decoration: underline;
        }
        .report-content h2, .report-content h3, .report-content h4 {
          color: var(--foreground);
          font-weight: 700;
          margin: 20px 0 10px;
        }
        .testimonial-scroll-wrapper {
          height: 100%;
          overflow: hidden;
        }
        .testimonial-scroll {
          animation: testimonialScroll 120s linear infinite;
        }
        .testimonial-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes testimonialScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>

      <Button variant="ghost" onClick={() => router.back()} className="mb-6 gap-2">
        <ArrowLeft className="size-4" /> Back to Reports
      </Button>

      {/* Header + Metadata — full width above grid */}
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{catName}</Badge>
          {report.reportstatus === 1 ? (
            <Badge className="bg-accent text-accent-foreground">Published</Badge>
          ) : (
            <Badge variant="outline">Upcoming</Badge>
          )}
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {report.keyword}
        </h1>
        {report.newssubject && report.newssubject !== report.keyword && (
          <p className="mt-2 text-sm text-muted-foreground">{report.newssubject}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-4 text-accent" />
            {report.forcastyear}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-4 text-accent" />
            {catName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-4 text-accent" />
            {report.no_pages ? `${report.no_pages} pages` : "N/A"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-5">
          {report.reportstatus === 1 && (
            <Button
              size="lg"
              className="gap-2"
              onClick={() => router.push(`/dashboard/reports/${report.newsid}/view`)}
            >
              <Eye className="size-4" />
              View Full Report
            </Button>
          )}
        </div>
      </div>

      {/* Content + Sidebar grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* ===== MAIN CONTENT ===== */}
        <div>
          {/* Summary */}
          {report.summary && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-xl">
                  <FileText className="size-5 text-accent" />
                  Report Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="report-content"
                  dangerouslySetInnerHTML={{ __html: report.summary }}
                />
              </CardContent>
            </Card>
          )}

          {/* Dynamic Content Sections */}
          {sections.map((section, idx) => (
            <Card key={idx} className="mb-6">
              <CardHeader>
                <CardTitle className="font-serif text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="report-content"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ===== SIDEBAR ===== */}
        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-6">
            {/* Why Coherent Market Insights */}
            <Card className="overflow-hidden border-accent/20 bg-gradient-to-b from-secondary to-background">
              <CardHeader className="pb-3">
                <CardTitle className="text-center font-serif text-base font-bold tracking-wide">
                  WHY COHERENT MARKET INSIGHTS?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-0">
                {[
                  { icon: ShieldCheck, value: "85-92%", label: "Proof of Authenticity" },
                  { icon: Users, value: "73%+", label: "Client Retention Rate" },
                  { icon: Timer, value: "24 Hours", label: "Quick Turn-around" },
                  { icon: Target, value: "1200+", label: "Niche Segments" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
                      <stat.icon className="size-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Credibility & Certifications */}
            <Card className="overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0e1f38] to-[#0a1a2e] text-white">
              <CardHeader className="pb-3">
                <div className="mb-1 flex items-center justify-center gap-2">
                  <Award className="size-4 text-teal-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-teal-300">Certified Excellence</span>
                </div>
                <CardTitle className="text-center font-serif text-base text-white">
                  Credibility & Certifications
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 pt-0">
                {[
                  { src: "https://www.coherentmarketinsights.com/images/duns-registerednewupdsma.webp", label: "DUNS", w: 50, h: 44 },
                  { src: "https://www.coherentmarketinsights.com/newfootimg/esomar2026.avif", label: "ESOMAR", w: 90, h: 34 },
                  { src: "https://www.coherentmarketinsights.com/images/iso-9001--NewUpda.webp", label: "ISO 9001", w: 48, h: 48 },
                  { src: "https://www.coherentmarketinsights.com/images/iso-27001--NewUpda.webp", label: "ISO 27001", w: 48, h: 48 },
                  { src: "https://www.coherentmarketinsights.com/images/clutupdatednewupdsma.webp", label: "Clutch", w: 80, h: 38 },
                  { src: "https://www.coherentmarketinsights.com/images/Trustpilot-27.webp", label: "Trustpilot", w: 90, h: 50 },
                ].map((cert, i) => (
                  <div key={i} className="flex flex-col items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
                    <img src={cert.src} alt={cert.label} width={cert.w} height={cert.h} loading="lazy" className="max-h-12 object-contain" />
                    <p className="mt-1.5 text-[9px] font-medium text-slate-500">{cert.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            {/* Our Clientele */}
            <Card className="overflow-hidden border-accent/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-center font-serif text-base font-bold tracking-wide">
                  Our Clientele
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-3 gap-1.5">
                  {CLIENT_LOGOS.slice(0, 12).map((file, i) => (
                    <div key={i} className="flex items-center justify-center rounded-md border bg-white p-1.5">
                      <img
                        src={`https://www.coherentmarketinsights.com/images/clients/${file}`}
                        alt={file.replace(/\.\w+$/, "").replace(/[_-]/g, " ")}
                        loading="lazy"
                        className="h-7 object-contain"
                      />
                    </div>
                  ))}
                </div>
                <a
                  href="https://www.coherentmarketinsights.com/trusted-by"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md bg-teal-600 px-4 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                >
                  View All Our Clients &rarr;
                </a>
              </CardContent>
            </Card>

            {/* Testimonials — vertical scrolling marquee */}
            <Card className="overflow-hidden border-accent/20 bg-gradient-to-b from-secondary to-background">
              <CardHeader className="pb-3">
                <div className="mb-1 flex items-center justify-center gap-2">
                  <Quote className="size-4 text-accent" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">What Our Clients Say</span>
                </div>
                <CardTitle className="text-center font-serif text-base font-bold tracking-wide">
                  Testimonials
                </CardTitle>
              </CardHeader>
              <CardContent className="relative overflow-hidden pt-0" style={{ height: "600px" }}>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-secondary to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background to-transparent" />
                <div className="testimonial-scroll-wrapper">
                  <div className="testimonial-scroll">
                    {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                      <div key={i} className="mb-4 rounded-lg border border-accent/10 bg-background/60 p-3">
                        <div className="mb-2 flex items-start gap-2.5">
                          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
                            <img
                              src={`https://www.coherentmarketinsights.com/images/testimg/${t.logo}`}
                              alt={t.company}
                              className="h-7 w-7 object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold text-foreground">{t.company}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{t.role}</p>
                          </div>
                        </div>
                        <p className="text-[11px] italic leading-relaxed text-muted-foreground">
                          &ldquo;{t.quote}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </aside>
      </div>

    </div>
  )
}
