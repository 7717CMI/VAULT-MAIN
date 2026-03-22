export interface ReportChartData {
  regionalShare: { region: string; share: number }[]
  segmentShare: { segment: string; share: number }[]
  marketGrowth: { year: string; value: number }[]
  metadata: {
    marketSize: string
    marketSizeProjected: string
    cagr: string
    forecastEnd: string
    unit: string
  }
}

export function extractChartData(summary: string): ReportChartData | null {
  const chartData: ReportChartData = {
    regionalShare: [],
    segmentShare: [],
    marketGrowth: [],
    metadata: { marketSize: "", marketSizeProjected: "", cagr: "", forecastEnd: "2033", unit: "Mn" },
  }

  const regionPatterns = [
    { name: "North America", pattern: /North America[^.]*?([\d.]+)\s*%/i },
    { name: "Europe", pattern: /Europe[^.]*?([\d.]+)\s*%/i },
    { name: "Asia Pacific", pattern: /Asia Pacific[^.]*?([\d.]+)\s*%/i },
    { name: "Latin America", pattern: /Latin America[^.]*?([\d.]+)\s*%/i },
    { name: "Middle East & Africa", pattern: /Middle East[^.]*?([\d.]+)\s*%/i },
  ]

  for (const rp of regionPatterns) {
    const match = summary.match(rp.pattern)
    if (match) chartData.regionalShare.push({ region: rp.name, share: parseFloat(match[1]) })
  }

  const remainingShare = chartData.regionalShare.reduce((sum, r) => sum + r.share, 0)
  if (chartData.regionalShare.length > 0 && remainingShare < 100) {
    const missing = regionPatterns
      .filter((rp) => !chartData.regionalShare.some((r) => r.region === rp.name))
      .map((rp) => rp.name)
    if (missing.length > 0) {
      const gap = 100 - remainingShare
      const minShare = 2.0
      if (gap < missing.length * minShare) {
        const excess = missing.length * minShare - gap
        const presentRegions = chartData.regionalShare.filter((r) => r.share > minShare)
        const presentTotal = presentRegions.reduce((s, r) => s + r.share, 0)
        for (const r of presentRegions) {
          r.share = Math.round((r.share - (excess * r.share / presentTotal)) * 10) / 10
        }
        missing.forEach((name) => chartData.regionalShare.push({ region: name, share: minShare }))
      } else {
        const each = Math.max(minShare, Math.round((gap / missing.length) * 10) / 10)
        missing.forEach((name) => chartData.regionalShare.push({ region: name, share: each }))
      }
    }
  }

  const sizeMatch = summary.match(
    /(?:valued at|estimated)[^.]*?(?:USD|US\$)\s*([\d,.]+)\s*(Bn|Mn|billion|million)/i
  )
  if (sizeMatch) {
    const val = parseFloat(sizeMatch[1].replace(/,/g, ""))
    const unit = sizeMatch[2].charAt(0).toUpperCase() === "B" ? "Bn" : "Mn"
    chartData.metadata.marketSize = `USD ${val} ${unit}`
    chartData.metadata.unit = unit
  }

  const projMatch = summary.match(
    /(?:reach|expected to reach|projected)[^.]*?(?:USD|US\$)\s*([\d,.]+)\s*(Bn|Mn|billion|million)/i
  )
  if (projMatch) {
    chartData.metadata.marketSizeProjected = `USD ${parseFloat(projMatch[1].replace(/,/g, ""))} ${
      projMatch[2].charAt(0).toUpperCase() === "B" ? "Bn" : "Mn"
    }`
  }

  const cagrMatch = summary.match(/CAGR[^.]*?([\d.]+)\s*%/i)
  if (cagrMatch) chartData.metadata.cagr = cagrMatch[1]

  const endYearMatch = summary.match(/(?:by|to)\s*(20\d{2})/i)
  if (endYearMatch) chartData.metadata.forecastEnd = endYearMatch[1]

  if (sizeMatch && cagrMatch) {
    const baseVal = parseFloat(sizeMatch[1].replace(/,/g, ""))
    const cagr = parseFloat(cagrMatch[1]) / 100
    const startYear = 2026
    const endYear = parseInt(chartData.metadata.forecastEnd)

    for (let y = startYear; y <= endYear; y++) {
      const value = Math.round(baseVal * Math.pow(1 + cagr, y - startYear) * 10) / 10
      chartData.marketGrowth.push({ year: String(y), value })
    }
  }

  if (chartData.regionalShare.length === 0 && chartData.marketGrowth.length === 0) return null
  return chartData
}

export function validateMarketConsistency(
  baseSize: number,
  sizeProjected: number,
  cagr: number,
  years: number
): { valid: boolean; expected: number; deviation: number } {
  const expected = Math.round(baseSize * Math.pow(1 + cagr / 100, years) * 10) / 10
  const deviation = Math.abs((sizeProjected - expected) / expected) * 100
  return { valid: deviation < 15, expected, deviation: Math.round(deviation * 10) / 10 }
}
