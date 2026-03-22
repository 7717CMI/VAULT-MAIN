"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { SectionHeader } from "@/components/section-header"
import { ReportCard } from "@/components/dashboard/report-card"
import { CategoryTabs } from "@/components/dashboard/category-selector"
import { Button } from "@/components/ui/button"
import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react"

interface ReportData {
  newsid: number
  keyword: string
  catid: number
  forcastyear: string
  createddate: string
  reportstatus: number | null
}

function TrendingReportsContent() {
  const searchParams = useSearchParams()
  const catIdParam = searchParams.get("catId")
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    catIdParam ? Number(catIdParam) : null
  )
  const [page, setPage] = useState(1)
  const [reports, setReports] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReports() {
      setLoading(true)
      try {
        const catParam = selectedCategory ? `&catId=${selectedCategory}` : ""
        const res = await fetch(`/api/reports/recent?limit=60${catParam}`)
        if (res.ok) {
          const data = await res.json()
          setReports(data.reports || [])
        }
      } catch {
        setReports([])
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
    setPage(1)
  }, [selectedCategory])

  const ITEMS_PER_PAGE = 15
  const totalPages = Math.max(1, Math.ceil(reports.length / ITEMS_PER_PAGE))
  const paginatedReports = reports.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="size-5 text-accent" />
        <SectionHeader
          title="Trending Reports"
          description="Browse all published market research reports"
          align="left"
          className="max-w-none"
        />
      </div>

      <div className="mb-8">
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelect={(catId) => setSelectedCategory(catId === 0 ? null : catId)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : paginatedReports.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedReports.map((report) => (
            <ReportCard key={report.newsid} report={report} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No trending reports found for this category.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span className="px-4 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default function TrendingReportsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}>
      <TrendingReportsContent />
    </Suspense>
  )
}
