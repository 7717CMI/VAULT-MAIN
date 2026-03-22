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
import { ClipboardList, ArrowRight, Trash2 } from "lucide-react"

interface RequestedReport {
  reptid: number
  reptitle: string
  downdate: string
}

export default function RequestedReportsPage() {
  const [reports, setReports] = useState<RequestedReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("requestedReports") || "[]")
    setReports(stored)
    setLoading(false)
  }, [])

  function removeReport(reptid: number) {
    const updated = reports.filter((r) => r.reptid !== reptid)
    setReports(updated)
    localStorage.setItem("requestedReports", JSON.stringify(updated))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <ClipboardList className="size-5 text-accent" />
        <SectionHeader
          title="Requested Reports"
          description="Reports you have requested and are pending"
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
                    <Badge variant="outline" className="text-[10px]">
                      Requested
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {report.downdate}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/reports/${report.reptid}`}>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeReport(report.reptid)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">You have not requested any reports yet.</p>
        </div>
      )}
    </div>
  )
}
