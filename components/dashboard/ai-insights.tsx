"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  FileText,
  ShieldCheck,
  Users,
  Timer,
  Target,
  Award,
  Quote,
  Globe,
  TrendingUp,
  PieChartIcon,
  Eye,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { CLIENT_LOGOS } from "@/lib/clients"
import { TESTIMONIALS } from "@/lib/testimonials"
import { getCategoryName } from "@/lib/data"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts"

interface AIInsightsProps {
  query: string
}

interface ChartData {
  regionalShare: { region: string; share: number }[]
  segmentShare: { segment: string; share: number }[]
  marketGrowth: { year: string; value: number }[]
  metadata: {
    marketSize: string
    marketSizeProjected: string
    cagr: string
    forecastEnd: string
    unit: string
  }
}

interface AIReport {
  keyword: string
  newssubject?: string
  forcastyear: string
  summary: string
}

const CHART_COLORS = [
  "#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
]

function MarketGrowthChart({ data, unit }: { data: ChartData["marketGrowth"]; unit: string }) {
  return (
    <div className="my-6">
      <Card className="border-accent/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-accent" />
            Global Market Size Forecast (USD {unit}, 2026-{data[data.length - 1]?.year || "2033"})
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`USD ${value} ${unit}`, "Market Size"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0d9488"
                strokeWidth={2.5}
                fill="url(#growthGradient)"
                dot={{ fill: "#0d9488", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "#0d9488", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function RegionalShareChart({ data }: { data: ChartData["regionalShare"] }) {
  return (
    <div className="my-6">
      <Card className="border-accent/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4 text-accent" />
            Regional Market Share (%), 2026
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={3}
                dataKey="share"
                nameKey="region"
                label={({ share }) => `${share}%`}
                labelLine={{ strokeWidth: 1 }}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [`${value}%`, name]}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function SegmentShareChart({ data }: { data: ChartData["segmentShare"] }) {
  if (!data || data.length === 0) return null

  return (
    <div className="my-6">
      <Card className="border-accent/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <PieChartIcon className="size-4 text-accent" />
            Segment Distribution (%), 2026
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                dataKey="segment"
                type="category"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value}%`, "Market Share"]}
              />
              <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

type SplitPart =
  | { type: "html"; content: string }
  | { type: "chart"; chart: "growth" | "regional" | "segment" }

function splitContentWithCharts(html: string): SplitPart[] {
  const parts: SplitPart[] = []

  const regionalPattern = /<h3[^>]*>.*?Regional Insights.*?<\/h3>/i
  const segmentalPattern = /<h3[^>]*>.*?(?:Segmental Insights|Why Does the).*?<\/h3>/i
  const keyTakeawaysPattern = /<h3[^>]*>.*?Key Takeaways.*?<\/h3>/i

  const regionalMatch = html.match(regionalPattern)
  const segmentalMatch = html.match(segmentalPattern)
  const keyTakeawaysMatch = html.match(keyTakeawaysPattern)

  const insertions: { index: number; chart: "growth" | "regional" | "segment" }[] = []

  if (keyTakeawaysMatch && keyTakeawaysMatch.index !== undefined) {
    insertions.push({ index: keyTakeawaysMatch.index, chart: "growth" })
  }

  if (segmentalMatch && segmentalMatch.index !== undefined) {
    const afterHeading = segmentalMatch.index + segmentalMatch[0].length
    insertions.push({ index: afterHeading, chart: "segment" })
  }

  if (regionalMatch && regionalMatch.index !== undefined) {
    const afterHeading = regionalMatch.index + regionalMatch[0].length
    insertions.push({ index: afterHeading, chart: "regional" })
  }

  insertions.sort((a, b) => a.index - b.index)

  if (insertions.length === 0) {
    return [{ type: "html", content: html }]
  }

  let cursor = 0
  for (const ins of insertions) {
    if (ins.index > cursor) {
      parts.push({ type: "html", content: html.substring(cursor, ins.index) })
    }
    parts.push({ type: "chart", chart: ins.chart })
    cursor = ins.index
  }
  if (cursor < html.length) {
    parts.push({ type: "html", content: html.substring(cursor) })
  }

  return parts
}

export function AIInsights({ query }: AIInsightsProps) {
  const router = useRouter()
  const [report, setReport] = useState<AIReport | null>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewReportPhase, setViewReportPhase] = useState<
    "idle" | "loading" | "unable" | "similar"
  >("idle")
  const [similarReports, setSimilarReports] = useState<
    { newsid: number; keyword: string; catid: number; forcastyear: string; reportstatus: number | null }[]
  >([])

  const handleViewReport = useCallback(async () => {
    setViewReportPhase("loading")

    await new Promise((r) => setTimeout(r, 2000))
    setViewReportPhase("unable")

    try {
      const res = await fetch(
        `/api/reports/similar?q=${encodeURIComponent(query)}&limit=6`
      )
      if (res.ok) {
        const data = await res.json()
        setSimilarReports(data.reports || [])
      }
    } catch {
      /* no similar reports to show */
    }

    await new Promise((r) => setTimeout(r, 800))
    setViewReportPhase("similar")
  }, [query])

  useEffect(() => {
    async function fetchReport() {
      setLoading(true)
      setError("")
      try {
        const res = await fetch("/api/ai/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        })
        if (!res.ok) {
          const errBody = await res.text().catch(() => "")
          throw new Error(`Failed (${res.status}): ${errBody}`)
        }
        const data = await res.json()
        setReport(data.report || null)
        setChartData(data.chartData || null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        console.error("[AI Report] Error:", msg)
        setError(`Unable to load report: ${msg}`)
      } finally {
        setLoading(false)
      }
    }

    if (query) fetchReport()
  }, [query])

  const contentParts = useMemo(() => {
    if (!report?.summary) return []
    return splitContentWithCharts(report.summary)
  }, [report?.summary])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-5">
          <div className="size-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading report&hellip;</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">{error || "Unable to load report."}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <style jsx global>{`
        .report-content {
          font-size: 14px;
          line-height: 1.75;
          color: var(--muted-foreground);
        }
        .report-content p { margin-bottom: 12px; }
        .report-content strong, .report-content b {
          color: var(--foreground);
          font-weight: 600;
        }
        .report-content ul, .report-content ol {
          margin: 8px 0 12px 20px;
          padding: 0;
        }
        .report-content li { margin-bottom: 8px; }
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
        .report-content table tr:nth-child(even) { background: var(--secondary); }
        .report-content .tblcolBG {
          background: var(--secondary) !important;
          font-weight: 600;
          color: var(--foreground);
        }
        .report-content .marketReptable { margin: 24px 0; }
        .report-content .market_tabhead h4 {
          font-size: 16px;
          font-weight: 700;
          color: var(--foreground);
          margin: 14px 0;
        }
        .report-content .market_tblimg { display: none; }
        .report-content img { display: none; }
        .report-content a {
          color: var(--accent);
          text-decoration: underline;
        }
        .report-content h2 {
          color: var(--foreground);
          font-weight: 700;
          font-size: 22px;
          margin: 28px 0 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--accent);
        }
        .report-content h3 {
          color: var(--foreground);
          font-weight: 700;
          font-size: 18px;
          margin: 24px 0 10px;
        }
        .report-content h4 {
          color: var(--foreground);
          font-weight: 600;
          font-size: 15px;
          margin: 18px 0 8px;
        }
        .report-content .faq-section { margin: 16px 0; }
        .report-content .faq-item {
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-bottom: 10px;
          overflow: hidden;
        }
        .report-content .faq-item h4 {
          background: var(--secondary);
          margin: 0;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
          cursor: default;
        }
        .report-content .faq-item p {
          padding: 12px 16px;
          margin: 0;
          font-size: 13px;
        }
        .report-content .table-responsive {
          overflow-x: auto;
          margin: 12px 0;
          border-radius: 8px;
        }
        .report-content .marketReptableinfo {
          border-radius: 8px;
          overflow: hidden;
        }
        .report-content .marketReptableinfo td,
        .report-content .marketReptableinfo th {
          font-size: 13px;
          line-height: 1.5;
        }
        .report-content thead th {
          background: var(--secondary) !important;
        }
        .report-content ul ul {
          margin-top: 4px;
          margin-bottom: 4px;
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

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
          {report.newssubject || report.keyword}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-4 text-accent" />
            Forecast: {report.forcastyear}
          </span>
        </div>
        <div className="mt-5">
          <Button
            size="lg"
            className="gap-2"
            onClick={handleViewReport}
            disabled={viewReportPhase !== "idle"}
          >
            <Eye className="size-4" />
            View Report
          </Button>
        </div>
      </div>

      {/* View Report Overlay */}
      {viewReportPhase !== "idle" && (
        <div className="mb-8">
          {viewReportPhase === "loading" && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16">
                <div className="size-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading report&hellip;</p>
              </CardContent>
            </Card>
          )}

          {viewReportPhase === "unable" && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16">
                <div className="size-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="size-5" />
                  <p className="text-sm font-medium">Unable to fetch report</p>
                </div>
                <p className="text-xs text-muted-foreground">Looking for similar reports&hellip;</p>
              </CardContent>
            </Card>
          )}

          {viewReportPhase === "similar" && (
            <Card className="border-accent/20">
              <CardHeader>
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="size-5" />
                  <span className="text-sm font-medium">Unable to fetch report</span>
                </div>
                <CardTitle className="mt-3 font-serif text-lg">
                  Here Are Some Similar Reports
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  We found these published reports that may match your interest.
                </p>
              </CardHeader>
              <CardContent>
                {similarReports.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No similar reports found. Please try a different search.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {similarReports.map((sr) => (
                      <button
                        key={sr.newsid}
                        onClick={() => router.push(`/dashboard/reports/${sr.newsid}`)}
                        className="flex w-full items-start gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-secondary"
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                          <FileText className="size-4 text-accent" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium leading-snug text-foreground">
                            {sr.keyword}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {getCategoryName(sr.catid)}
                            </Badge>
                            {sr.reportstatus === 1 ? (
                              <Badge className="bg-accent/10 text-accent text-xs">Published</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Upcoming</Badge>
                            )}
                            {sr.forcastyear && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <BarChart3 className="size-3" />
                                Forecast: {sr.forcastyear}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Content + Sidebar grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Main Content with inline charts */}
        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-xl">
                <FileText className="size-5 text-accent" />
                Report Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contentParts.map((part, i) => {
                if (part.type === "html") {
                  return (
                    <div
                      key={i}
                      className="report-content"
                      dangerouslySetInnerHTML={{ __html: part.content }}
                    />
                  )
                }
                if (part.type === "chart" && chartData) {
                  if (part.chart === "growth" && chartData.marketGrowth.length > 0) {
                    return <MarketGrowthChart key={i} data={chartData.marketGrowth} unit={chartData.metadata.unit} />
                  }
                  if (part.chart === "regional" && chartData.regionalShare.length > 0) {
                    return <RegionalShareChart key={i} data={chartData.regionalShare} />
                  }
                  if (part.chart === "segment" && chartData.segmentShare.length > 0) {
                    return <SegmentShareChart key={i} data={chartData.segmentShare} />
                  }
                }
                return null
              })}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-6">
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
