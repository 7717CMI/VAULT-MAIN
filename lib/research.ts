import { tavily } from "@tavily/core"

function getClient() {
  return tavily({ apiKey: process.env.TAVILY_API_KEY || "" })
}

export interface MarketResearchData {
  marketSize: string | null
  marketSizeProjected: string | null
  baseYear: string
  forecastStart: string
  forecastEnd: string
  cagr: string | null
  keyPlayers: string[]
  segments: Record<string, string[]>
  regionShares: { name: string; share: string }[]
  currentEvents: { event: string; detail: string }[]
  companyDevelopments: { date: string; company: string; detail: string }[]
  sources: string[]
  rawMarketData: string
  rawCompetitive: string
  rawEvents: string
  rawSegments: string
  rawRegulatory: string
}

export async function researchMarket(topic: string): Promise<MarketResearchData> {
  const result: MarketResearchData = {
    marketSize: null,
    marketSizeProjected: null,
    baseYear: "2025",
    forecastStart: "2026",
    forecastEnd: "2033",
    cagr: null,
    keyPlayers: [],
    segments: {},
    regionShares: [],
    currentEvents: [],
    companyDevelopments: [],
    sources: [],
    rawMarketData: "",
    rawCompetitive: "",
    rawEvents: "",
    rawSegments: "",
    rawRegulatory: "",
  }

  if (!process.env.TAVILY_API_KEY) return result

  try {
    const queries = [
      `"${topic}" market size 2025 2026 2032 2033 CAGR forecast revenue USD billion million valuation`,
      `"${topic}" market key players companies revenue market share percentage competitive landscape 2024 2025 2026`,
      `"${topic}" market segmentation share percentage by type by application by technology by region North America Asia Pacific Europe Latin America`,
      `"${topic}" market statistics data trends adoption rate penetration rate investment funding regulatory approval 2024 2025 2026`,
      `"${topic}" market news partnership acquisition launch funding round investment deal 2025 2026`,
      `"${topic}" industry report statistics survey study data findings research 2024 2025 2026`,
      `"${topic}" FDA approval EMA regulation government policy ban mandate standard compliance guideline tariff subsidy law act 2024 2025 2026`,
    ]

    const responses = await Promise.all(
      queries.map((q) =>
        getClient().search(q, {
          maxResults: 7,
          searchDepth: "advanced",
          includeAnswer: true,
        })
      )
    )

    const buckets: string[][] = [[], [], [], [], [], [], []]
    const allSources = new Set<string>()

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i]
      if (res.answer) buckets[i].push(res.answer)
      for (const r of res.results) {
        if (r.content) buckets[i].push(r.content)
        if (r.url) allSources.add(r.url)
      }
    }

    result.rawMarketData = buckets[0].join("\n\n").substring(0, 7000)
    result.rawCompetitive = buckets[1].join("\n\n").substring(0, 6000)
    result.rawSegments = buckets[2].join("\n\n").substring(0, 6000)
    result.rawEvents = [
      ...buckets[3].slice(0, 4),
      ...buckets[4].slice(0, 4),
      ...buckets[5].slice(0, 4),
    ].join("\n\n").substring(0, 7000)
    result.rawRegulatory = buckets[6].join("\n\n").substring(0, 6000)
    result.sources = [...allSources].slice(0, 15)

    const fullText = buckets.flat().join(" ")

    const sizeMatch = fullText.match(
      /(?:valued at|estimated at|reached|worth|size[^.]*?)\s*(?:USD|US\$|\$)\s*([\d,.]+)\s*(billion|million|Bn|Mn)/i
    )
    if (sizeMatch) {
      const unit = sizeMatch[2].charAt(0).toUpperCase() === "B" ? "Bn" : "Mn"
      result.marketSize = `USD ${sizeMatch[1]} ${unit}`
    }

    const projMatch = fullText.match(
      /(?:reach|projected to|expected to reach|grow to)[^.]*?(?:USD|US\$|\$)\s*([\d,.]+)\s*(billion|million|Bn|Mn)/i
    )
    if (projMatch) {
      const unit = projMatch[2].charAt(0).toUpperCase() === "B" ? "Bn" : "Mn"
      result.marketSizeProjected = `USD ${projMatch[1]} ${unit}`
    }

    const cagrMatch = fullText.match(/CAGR[^.]*?([\d.]+)\s*%/i)
    if (cagrMatch) result.cagr = cagrMatch[1]

    const forecastMatch = fullText.match(/(\d{4})\s*(?:to|-|–)\s*(20\d{2})/i)
    if (forecastMatch) {
      result.forecastStart = forecastMatch[1]
      result.forecastEnd = forecastMatch[2]
    }

    const playerPatterns = [
      /(?:key players|major players|leading companies|companies covered|top companies|prominent players|market players)[:\s]*((?:[A-Z][\w\s&.,''()\-]+(?:,|;|and)\s*)+[A-Z][\w\s&.,''()\-]+)/gi,
      /(?:include|such as|like)\s+((?:[A-Z][\w\s&.]+(?:,|;|and)\s*)+[A-Z][\w\s&.]+)/gi,
    ]
    for (const pat of playerPatterns) {
      const matches = fullText.match(pat)
      if (matches && result.keyPlayers.length === 0) {
        const names = matches[0]
          .replace(/^[^:]*[:\s]+/i, "")
          .split(/[,;]/)
          .map((s) => s.replace(/\band\b/gi, "").replace(/\binclude\b/gi, "").replace(/\bsuch as\b/gi, "").replace(/\blike\b/gi, "").trim())
          .filter((s) => s.length > 2 && s.length < 80 && /^[A-Z]/.test(s))
        result.keyPlayers = [...new Set(names)].slice(0, 15)
      }
    }
  } catch (err) {
    console.error("[Research] Tavily search error:", err)
  }

  return result
}
