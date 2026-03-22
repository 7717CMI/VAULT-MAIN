"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ReportViewerPage() {
  const params = useParams()
  const router = useRouter()
  const [mode, setMode] = useState<"loading" | "pdf" | "unavailable">("loading")
  const [keyword, setKeyword] = useState("")

  const pdfUrl = `/api/reports/${params.id}/view`

  useEffect(() => {
    async function init() {
      // Check if the API returns a real PDF
      try {
        const res = await fetch(pdfUrl)
        const contentType = res.headers.get("content-type") || ""
        if (contentType.includes("application/pdf")) {
          setMode("pdf")
        } else {
          setMode("unavailable")
        }
      } catch {
        setMode("unavailable")
      }

      // Fetch title
      try {
        const res = await fetch(`/api/reports/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setKeyword(data.report?.keyword || "Report")
        }
      } catch { /* optional */ }
    }
    init()
  }, [params.id, pdfUrl])

  if (mode === "loading") {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </div>
      </div>
    )
  }

  if (mode === "unavailable") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 gap-2">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <FileWarning className="size-12 text-muted-foreground" />
          <h2 className="font-serif text-xl font-bold">PDF Not Available</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            The PDF for this report is not available yet. Please check back later or contact support.
          </p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="mr-2 size-4" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <span className="truncate text-sm font-medium">{keyword}</span>
      </div>
      <div className="flex-1">
        <iframe src={`${pdfUrl}#toolbar=0&navpanes=0`} className="size-full border-0" title={keyword || "Report PDF"} />
      </div>
    </div>
  )
}
