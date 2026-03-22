"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, ArrowRight } from "lucide-react"

interface DownloadedReport {
  reptid: number
  reptitle: string
  downdate: string
}

export default function DownloadedReportsPage() {
  const [reports, setReports] = useState<DownloadedReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch("/api/reports/downloaded")
        if (res.ok) {
          const data = await res.json()
          setReports(data.reports || [])
        }
      } catch {
        // Empty
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <Download className="size-5 text-accent" />
        <SectionHeader
          title="Downloaded Reports"
          description="Reports you have downloaded"
          align="left"
          className="max-w-none"
        />
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
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Date/Time</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report, idx) => (
                <TableRow key={report.reptid}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{report.reptitle}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge className="bg-green-600/10 text-[10px] text-green-700">
                      Downloaded
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {report.downdate}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/reports/${report.reptid}`}>
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
          <p className="text-muted-foreground">You have not downloaded any reports yet.</p>
        </div>
      )}
    </div>
  )
}
