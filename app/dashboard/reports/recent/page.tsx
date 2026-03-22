"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getCategoryName } from "@/lib/data"
import { FileText, ArrowRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react"

interface ReportData {
  newsid: number
  keyword: string
  catid: number
  forcastyear: string
  createddate: string
  reportstatus: number | null
}

const ITEMS_PER_PAGE = 30

export default function RecentReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    async function fetchReports() {
      setLoading(true)
      try {
        const searchParam = debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ""
        const res = await fetch(`/api/reports/recent?page=${page}&limit=${ITEMS_PER_PAGE}${searchParam}`)
        if (res.ok) {
          const data = await res.json()
          setReports(data.reports || [])
          setTotalPages(data.totalPages || 1)
          setTotal(data.total || 0)
        }
      } catch {
        // empty
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [page, debouncedQuery])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-accent" />
          <SectionHeader
            title="Recently Added Reports"
            description={`${total.toLocaleString()} reports available`}
            align="left"
            className="max-w-none"
          />
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search reports by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border bg-background pl-10 pr-10 text-sm outline-none focus:border-accent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : reports.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Sr.</TableHead>
                <TableHead>Report Name</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report, idx) => (
                <TableRow key={report.newsid}>
                  <TableCell className="text-muted-foreground">
                    {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-medium">{report.keyword}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="text-[10px]">
                      {getCategoryName(report.catid)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {report.reportstatus === 1 ? (
                      <Badge className="bg-accent text-[10px] text-accent-foreground">Published</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/reports/${report.newsid}`}>
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No recent reports found.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span className="px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
