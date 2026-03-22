"use client"

import { useState, useEffect, useRef, Suspense, lazy } from "react"
import { useRouter } from "next/navigation"
import { SectionHeader } from "@/components/section-header"
import { ReportCarousel } from "@/components/dashboard/report-carousel"
import { Button } from "@/components/ui/button"
import { categories } from "@/lib/data"
import {
  TrendingUp, Clock, Search, BarChart3, Globe, FileText,
  Shield, ArrowRight, X, ShieldCheck, Users, Timer, Target, Award, BookOpen,
} from "lucide-react"

const HeroScene = lazy(() =>
  import("@/components/dashboard/hero-scene").then((m) => ({ default: m.HeroScene }))
)

interface ReportData {
  newsid: number
  keyword: string
  catid: number
  forcastyear: string
  createddate: string
  reportstatus: number | null
}

interface SearchSuggestion {
  newsid: number
  keyword: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [trendingReports, setTrendingReports] = useState<ReportData[]>([])
  const [upcomingReports, setUpcomingReports] = useState<ReportData[]>([])
  const [toBePublished, setToBePublished] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalReports, setTotalReports] = useState(25000)

  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [reportsRes, statsRes] = await Promise.all([
          fetch("/api/reports/category"),
          fetch("/api/reports/stats"),
        ])
        if (reportsRes.ok) {
          const data = await reportsRes.json()
          setTrendingReports(data.trending || [])
          setUpcomingReports(data.upcoming || [])
          setToBePublished(data.toBePublished || [])
        }
        if (statsRes.ok) {
          await statsRes.json()
        }
      } catch {
        setTrendingReports([])
        setUpcomingReports([])
        setToBePublished([])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function handleSearch(value: string) {
    setSearchQuery(value)
    if (value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      const catParam = selectedCategory !== "all" ? `&catId=${selectedCategory}` : ""
      const res = await fetch(`/api/reports/search?q=${encodeURIComponent(value)}${catParam}`)
      const data = await res.json()
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch {
      setSuggestions([])
    }
  }

  return (
    <div>
      {/* ===== FULL-PAGE HERO ===== */}
      <section className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f2035] to-[#0a1a2e]">
        {/* Three.js Canvas */}
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>

        {/* Main hero content */}
        <div className="relative z-10 flex flex-1 items-center">
          <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,1fr)] lg:gap-32">
              {/* LEFT: Text content */}
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                  <span className="size-2 animate-pulse rounded-full bg-teal-400" />
                  {totalReports.toLocaleString()}+ Reports Available
                </div>

                <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Coherent&apos;s
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                    InsightVault
                  </span>
                </h1>

                <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400 lg:text-lg">
                  Access comprehensive market research reports across 26+ industries.
                  Make data-driven decisions with insights from global markets.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    className="gap-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-7 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:from-teal-600 hover:to-cyan-600 hover:shadow-teal-500/40"
                    onClick={() => router.push("/dashboard/reports/trending")}
                  >
                    <Search className="size-4" />
                    Explore Reports
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 rounded-full border-slate-600 bg-white/5 px-7 text-sm text-slate-300 backdrop-blur-sm hover:bg-white/10 hover:text-white"
                    onClick={() => router.push("/dashboard/reports/recent")}
                  >
                    Latest Reports
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>

              {/* RIGHT: Stats cards */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-2 gap-3">
                  <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md transition-all hover:border-teal-500/30 hover:bg-white/[0.08]">
                    <BarChart3 className="mb-3 size-7 text-teal-400 transition-transform group-hover:scale-110" />
                    <p className="text-2xl font-bold text-white">25,000+</p>
                    <p className="mt-0.5 text-xs text-slate-500">Reports Published</p>
                  </div>
                  <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md transition-all hover:border-cyan-500/30 hover:bg-white/[0.08]">
                    <Globe className="mb-3 size-7 text-cyan-400 transition-transform group-hover:scale-110" />
                    <p className="text-2xl font-bold text-white">6,000+</p>
                    <p className="mt-0.5 text-xs text-slate-500">Projects Till Date</p>
                  </div>
                  <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md transition-all hover:border-blue-500/30 hover:bg-white/[0.08]">
                    <FileText className="mb-3 size-7 text-blue-400 transition-transform group-hover:scale-110" />
                    <p className="text-2xl font-bold text-white">5,000+</p>
                    <p className="mt-0.5 text-xs text-slate-500">Clients Worldwide</p>
                  </div>
                  <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md transition-all hover:border-sky-500/30 hover:bg-white/[0.08]">
                    <Shield className="mb-3 size-7 text-sky-400 transition-transform group-hover:scale-110" />
                    <p className="text-2xl font-bold text-white">450+</p>
                    <p className="mt-0.5 text-xs text-slate-500">Analysts & Contract Consultants</p>
                  </div>
                </div>

                <a href="https://www.coherentmarketinsights.com/media-coverage" target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 backdrop-blur-md transition-all hover:border-teal-500/30 hover:bg-white/[0.08]">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-teal-500/40" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400">Media Coverage</p>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-teal-500/40" />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { src: "https://www.coherentmarketinsights.com/mediaimg/finance.yahoologo.jpg", alt: "Yahoo Finance" },
                      { src: "https://www.coherentmarketinsights.com/mediaimg/LT-15.jpg", alt: "Luxembourg Times" },
                      { src: "https://www.coherentmarketinsights.com/mediaimg/seekingalpha.jpg", alt: "Seeking Alpha" },
                      { src: "https://www.coherentmarketinsights.com/mediaimg/huffpost.jpeg", alt: "HuffPost" },
                      { src: "https://www.coherentmarketinsights.com/mediaimg/forbes.jpg", alt: "Forbes" },
                      { src: "https://www.coherentmarketinsights.com/mediaimg/fool.com.png", alt: "The Motley Fool" },
                      { src: "https://www.coherentmarketinsights.com/mediaimg/bbc1.jpg", alt: "BBC" },
                      { src: "https://images.yourstory.com/cs/images/homepage/footerV3_YS_black.svg", alt: "Your Story" },
                      { src: "https://upload.wikimedia.org/wikipedia/commons/3/3f/ET_NOW_220px.png", alt: "ETnow" },
                      { src: "https://upload.wikimedia.org/wikipedia/commons/9/98/The_Economic_Times_logo.svg", alt: "The Economic Times" },
                      { src: "https://upload.wikimedia.org/wikipedia/commons/9/98/The_Hindu_logo.svg", alt: "The Hindu" },
                      { src: "https://upload.wikimedia.org/wikipedia/en/0/07/The_Financial_Express_%28India%29_Logo.svg", alt: "Financial Express" },
                      { src: "https://indianexpress.com/wp-content/themes/indianexpress/images/indian-express-logo-n.svg", alt: "The Indian Express" },
                      { src: "https://www.dailypress.com/wp-content/uploads/2023/04/Daily_Press_logo-vdp-full-black.png", alt: "Daily Press" },
                      { src: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Asia_Times_logo.svg", alt: "Asia Times" },
                      { src: "https://upload.wikimedia.org/wikipedia/commons/6/63/Entrepreneur_Logo.png", alt: "Entrepreneur" },
                    ].map((m, i) => (
                      <div key={i} className="flex h-10 items-center justify-center rounded-lg bg-white p-2 transition-colors hover:bg-white/90">
                        <img
                          src={m.src}
                          alt={m.alt}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = "none"
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "block"
                          }}
                        />
                        <span className="hidden text-[10px] font-bold text-slate-700">{m.alt}</span>
                      </div>
                    ))}
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Search bar at the bottom of hero */}
        <div className="relative z-10 pb-4 pt-2">
          <div className="mx-auto max-w-7xl px-4 lg:px-8" ref={searchRef}>
            <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/[0.08] p-2 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 w-full shrink-0 cursor-pointer rounded-xl border-0 bg-white/10 px-3 text-sm font-medium text-white outline-none sm:w-auto"
              >
                <option value="all" className="bg-[#0f2035] text-white">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.catId} value={String(cat.catId)} className="bg-[#0f2035] text-white">
                    {cat.catName}
                  </option>
                ))}
              </select>

              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  placeholder="Search market research reports..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border-0 bg-transparent pl-11 pr-10 text-sm font-medium text-white placeholder:text-white/50 outline-none sm:bg-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setSuggestions([]); setShowSuggestions(false) }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-[#0f2035]/95 shadow-2xl backdrop-blur-xl">
                    {suggestions.map((s) => (
                      <button
                        key={s.newsid}
                        onClick={() => {
                          setShowSuggestions(false)
                          setSearchQuery("")
                          router.push(`/dashboard/reports/${s.newsid}`)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Search className="size-3.5 shrink-0 text-slate-500" />
                        <span className="truncate">{s.keyword}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                size="sm"
                className="h-10 w-full shrink-0 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 text-sm font-semibold text-white hover:from-teal-600 hover:to-cyan-600 sm:w-auto"
                onClick={() => {
                  if (searchQuery) {
                    const catParam = selectedCategory !== "all" ? `&catId=${selectedCategory}` : ""
                    router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}${catParam}`)
                  }
                }}
              >
                Search
              </Button>
            </div>
          </div>
        </div>

      </section>

      {/* ===== REPORTS SECTIONS ===== */}
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : (
          <>
            <section className="mb-14">
              <div className="mb-6 flex items-center gap-2">
                <TrendingUp className="size-5 text-accent" />
                <SectionHeader
                  title="Trending Reports"
                  description="Most recent published market research reports"
                  align="left"
                  className="max-w-none"
                />
              </div>
              <ReportCarousel reports={trendingReports} direction="right" />
            </section>

            <section className="mb-14">
              <div className="mb-6 flex items-center gap-2">
                <Clock className="size-5 text-accent" />
                <SectionHeader
                  title="Upcoming Reports"
                  description="Reports being prepared for publication"
                  align="left"
                  className="max-w-none"
                />
              </div>
              <ReportCarousel reports={upcomingReports} direction="left" />
            </section>

            <section className="mb-14">
              <div className="mb-6 flex items-center gap-2">
                <BookOpen className="size-5 text-accent" />
                <SectionHeader
                  title="To Be Published"
                  description="Reports in the pipeline awaiting publication"
                  align="left"
                  className="max-w-none"
                />
              </div>
              <ReportCarousel reports={toBePublished} direction="right" />
            </section>
          </>
        )}
      </div>

      {/* ===== EXISTING CLIENTELE ===== */}
      <section className="bg-white px-6 py-14 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-300" />
                <h2 className="whitespace-nowrap font-serif text-xl font-bold uppercase tracking-widest text-[#0a1628] md:text-2xl">
                  Existing Clientele
                </h2>
                <div className="h-px flex-1 bg-slate-300" />
              </div>
              <p className="text-base text-slate-600">
                Created billion dollars of revenue impact on thousands of clients.
              </p>
              <a
                href="https://www.coherentmarketinsights.com/trusted-by"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline"
              >
                View All Our Clients &rarr;
              </a>
            </div>
            <div className="text-center">
              <img
                src="https://www.coherentmarketinsights.com/allupimg/image/existing-clientele.webp"
                alt="Existing Clients Logo"
                width={450}
                height={200}
                loading="lazy"
                className="mx-auto max-w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== KEY STATS + DISCOVER LATEST INSIGHTS ===== */}
      <section className="overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_auto]">
          {/* Key Stats — dark blue side */}
          <div className="bg-gradient-to-br from-[#0a1628] via-[#0e2244] to-[#0a1a2e] px-6 py-14 lg:px-12">
            <div className="mx-auto max-w-3xl">
              <div className="mb-10 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/20" />
                <h2 className="whitespace-nowrap font-serif text-xl font-bold uppercase tracking-widest text-white md:text-2xl">
                  Key Stats
                </h2>
                <div className="h-px flex-1 bg-white/20" />
              </div>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { icon: "https://www.coherentmarketinsights.com/images/optcmihome-img/keyStatsIcons1.webp", value: "1,200+", label: "Insights Published Per Year" },
                  { icon: "https://www.coherentmarketinsights.com/images/optcmihome-img/keyStatsIcons2.webp", value: "4,800+", label: "Consulting Projects Still Now" },
                  { icon: "https://www.coherentmarketinsights.com/images/optcmihome-img/keyStatsIcons3.webp", value: "350+", label: "Analysts and Contract Consultants" },
                  { icon: "https://www.coherentmarketinsights.com/images/optcmihome-img/keyStatsIcons4.webp", value: "5,150+", label: "Clients Worldwide" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <img src={stat.icon} alt="" width={48} height={48} loading="lazy" className="mt-1 size-12 object-contain opacity-80" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="mt-0.5 text-sm text-slate-400">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Discover Latest Insights — green side */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-teal-600 to-cyan-700 px-8 py-14 text-center lg:w-[400px] lg:px-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px w-8 bg-white/40" />
              <h2 className="font-serif text-lg font-bold uppercase tracking-widest text-white md:text-xl">
                Discover Our Latest Insights
              </h2>
              <div className="h-px w-8 bg-white/40" />
            </div>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-white/90">
              For latest market insight related to Healthcare, Chemicals and Materials, ICT, Automation, Semiconductor & Electronics, Aerospace and Defense, Telecom and IT, Consumer Goods and Retail, Energy, Food and Beverages industry, visit.
            </p>
            <Button
              variant="outline"
              className="rounded-md border-white bg-white px-8 py-2 text-sm font-semibold text-[#0a1628] hover:bg-white/90"
              onClick={() => window.open("https://www.coherentmarketinsights.com/latest-insights", "_blank")}
            >
              Latest Insights
            </Button>
          </div>
        </div>
      </section>

      {/* ===== WHY COHERENT MARKET INSIGHTS ===== */}
      <section className="border-t bg-gradient-to-b from-secondary to-background py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mb-12 flex items-center justify-center gap-4">
            <div className="h-px flex-1 bg-accent/30" />
            <h2 className="whitespace-nowrap font-serif text-2xl font-bold tracking-wide text-foreground md:text-3xl">
              WHY COHERENT MARKET INSIGHTS?
            </h2>
            <div className="h-px flex-1 bg-accent/30" />
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group flex flex-col items-center text-center">
              <div className="mb-5 flex size-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 transition-all group-hover:border-accent/60 group-hover:bg-accent/20">
                <ShieldCheck className="size-9 text-accent transition-transform group-hover:scale-110" />
              </div>
              <p className="text-2xl font-bold text-foreground">85-92%</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Proof of Authenticity of Data</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Incisive insights cutting across sectors, categories, and geographical horizons
              </p>
            </div>

            <div className="group flex flex-col items-center text-center">
              <div className="mb-5 flex size-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 transition-all group-hover:border-accent/60 group-hover:bg-accent/20">
                <Users className="size-9 text-accent transition-transform group-hover:scale-110" />
              </div>
              <p className="text-2xl font-bold text-foreground">73%+</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Client Retention Rate</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                On an average, 73% of our existing clients have resubscribed to our services
              </p>
            </div>

            <div className="group flex flex-col items-center text-center">
              <div className="mb-5 flex size-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 transition-all group-hover:border-accent/60 group-hover:bg-accent/20">
                <Timer className="size-9 text-accent transition-transform group-hover:scale-110" />
              </div>
              <p className="text-2xl font-bold text-foreground">24 Hours</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Quick Turn-around</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Proven expertise of delivering optimized solutions
              </p>
            </div>

            <div className="group flex flex-col items-center text-center">
              <div className="mb-5 flex size-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 transition-all group-hover:border-accent/60 group-hover:bg-accent/20">
                <Target className="size-9 text-accent transition-transform group-hover:scale-110" />
              </div>
              <p className="text-2xl font-bold text-foreground">1200+</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Niche Segments</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The go-to research solution provider for complex, hard-to-find insights
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CREDIBILITY & CERTIFICATIONS ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0e1f38] to-[#0a1a2e] py-20">
        {/* Subtle background overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(20,184,166,0.04)_0%,_transparent_70%)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 lg:px-8">
          {/* Header */}
          <div className="mb-14 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-teal-300">
              <Award className="size-4" />
              Certified Excellence
            </div>
            <h2 className="font-serif text-3xl font-bold text-white md:text-4xl">
              Credibility & Certifications
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
              Recognized by global institutes for data authenticity, quality management, and information security.
            </p>
          </div>

          {/* Logos */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { src: "https://www.coherentmarketinsights.com/images/duns-registerednewupdsma.webp", alt: "DUNS Registered", label: "DUNS: 860519526", w: 80, h: 70 },
              { src: "https://www.coherentmarketinsights.com/newfootimg/esomar2026.avif", alt: "ESOMAR", label: "ESOMAR Member", w: 150, h: 56 },
              { src: "https://www.coherentmarketinsights.com/images/iso-9001--NewUpda.webp", alt: "ISO 9001:2015", label: "ISO 9001:2015", w: 75, h: 75 },
              { src: "https://www.coherentmarketinsights.com/images/iso-27001--NewUpda.webp", alt: "ISO 27001:2022", label: "ISO 27001:2022", w: 75, h: 75 },
              { src: "https://www.coherentmarketinsights.com/images/clutupdatednewupdsma.webp", alt: "Clutch", label: "Top Rated", w: 130, h: 60 },
              { src: "https://www.coherentmarketinsights.com/images/Trustpilot-27.webp", alt: "Trustpilot", label: "4.5 / 5 Rating", w: 140, h: 80 },
            ].map((cert, i) => (
              <div
                key={i}
                className="group relative flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 will-change-transform transition-[transform,border-color,background-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-teal-400/30 hover:bg-white/[0.08] hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)]"
              >
                <div className="flex h-20 items-center justify-center">
                  <img
                    src={cert.src}
                    alt={cert.alt}
                    width={cert.w}
                    height={cert.h}
                    loading="lazy"
                    decoding="async"
                    className="max-h-20 object-contain"
                  />
                </div>
                <p className="mt-3 text-center text-[11px] font-medium tracking-wide text-slate-500 transition-colors duration-300 group-hover:text-teal-300">
                  {cert.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
