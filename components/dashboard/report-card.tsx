import Link from "next/link"
import { BarChart3, ArrowRight } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCategoryName } from "@/lib/data"

interface ReportData {
  newsid: number
  keyword: string
  catid: number
  forcastyear: string
  createddate: string
  reportstatus: number | null
}

interface ReportCardProps {
  report: ReportData
  variant?: "default" | "compact"
}

export function ReportCard({ report, variant = "default" }: ReportCardProps) {
  const catName = getCategoryName(report.catid)

  return (
    <Card className="group flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {catName}
          </Badge>
          {report.reportstatus === 1 && (
            <Badge className="bg-accent text-[10px] text-accent-foreground">
              Published
            </Badge>
          )}
          {report.reportstatus === 0 && (
            <Badge variant="outline" className="text-[10px]">
              Upcoming
            </Badge>
          )}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
          {report.keyword}
        </h3>

        {variant === "default" && report.forcastyear && (
          <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="size-3" />
              {report.forcastyear}
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild variant="ghost" size="sm" className="ml-auto gap-1 text-accent">
          <Link href={`/dashboard/reports/${report.newsid}`}>
            View Report <ArrowRight className="size-3" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
