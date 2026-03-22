"use client"

import { useEffect, useState } from "react"
import { Package, CreditCard, Download, TrendingDown } from "lucide-react"

interface Stats {
  subscriptionPackage: number
  freeCredit: number
  totalDownloads: number
  remainingCredits: number
}

export function StatusCards() {
  const [stats, setStats] = useState<Stats>({
    subscriptionPackage: 250,
    freeCredit: 2,
    totalDownloads: 0,
    remainingCredits: 250,
  })

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/reports/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        // Use defaults
      }
    }
    fetchStats()
  }, [])

  const cards = [
    {
      label: "Subscription Package",
      value: stats.subscriptionPackage,
      icon: Package,
    },
    {
      label: "Free Credit",
      value: stats.freeCredit,
      icon: CreditCard,
    },
    {
      label: "Total Downloads",
      value: stats.totalDownloads,
      icon: Download,
    },
    {
      label: "Remaining Credits",
      value: stats.remainingCredits,
      icon: TrendingDown,
    },
  ]

  return (
    <div className="border-t border-border/50 bg-secondary/30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 overflow-x-auto px-4 py-2 lg:px-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex min-w-[140px] items-center gap-2 rounded-md bg-card px-3 py-2 shadow-sm"
          >
            <card.icon className="size-4 shrink-0 text-accent" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p className="text-sm font-bold text-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
