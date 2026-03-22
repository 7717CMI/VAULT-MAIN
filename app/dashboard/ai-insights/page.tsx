"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AIInsights } from "@/components/dashboard/ai-insights"

function AIInsightsContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
      <Button variant="ghost" className="mb-6 gap-2" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      </Button>

      {query ? (
        <AIInsights query={query} />
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            No search query provided. Use the search bar to find a report.
          </p>
        </div>
      )}
    </div>
  )
}

export default function AIInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="size-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      }
    >
      <AIInsightsContent />
    </Suspense>
  )
}
