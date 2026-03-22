"use client"

import { ReportCard } from "@/components/dashboard/report-card"

interface ReportData {
  newsid: number
  keyword: string
  catid: number
  forcastyear: string
  createddate: string
  reportstatus: number | null
}

interface ReportCarouselProps {
  reports: ReportData[]
  direction?: "left" | "right"
}

export function ReportCarousel({ reports, direction = "right" }: ReportCarouselProps) {
  if (reports.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No reports available in this category.
      </p>
    )
  }

  // Duplicate the list for seamless looping
  const items = [...reports, ...reports]
  const animationName = direction === "right" ? "marquee-right" : "marquee-left"

  return (
    <>
      <style jsx global>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .carousel-wrapper:hover .carousel-track {
          animation-play-state: paused !important;
        }
      `}</style>

      <div className="carousel-wrapper relative overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

        <div
          className="carousel-track flex w-max gap-4 py-2"
          style={{
            animation: `${animationName} ${reports.length * 4}s linear infinite`,
          }}
        >
          {items.map((report, idx) => (
            <div key={`${report.newsid}-${idx}`} className="w-[320px] shrink-0">
              <ReportCard report={report} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
