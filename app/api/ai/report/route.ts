import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query as dbQuery } from "@/lib/db"
import { researchMarket, type MarketResearchData } from "@/lib/research"
import { extractChartData, type ReportChartData } from "@/lib/charts"

async function getExampleSummary(): Promise<string> {
  try {
    const result = await dbQuery(
      `SELECT summary FROM cmi_reports
       WHERE isactive = 1 AND reportstatus = 1 AND summary IS NOT NULL
         AND LENGTH(summary) BETWEEN 10000 AND 18000
       ORDER BY newsid DESC LIMIT 1`
    )
    if (result.rows.length > 0) return result.rows[0].summary
  } catch { /* fallback */ }
  return ""
}

function buildResearchBlock(research: MarketResearchData): string {
  const lines: string[] = []

  if (research.marketSize) lines.push(`Market Size (Current): ${research.marketSize}`)
  if (research.marketSizeProjected) lines.push(`Market Size (Projected): ${research.marketSizeProjected}`)
  if (research.cagr) lines.push(`CAGR: ${research.cagr}%`)
  lines.push(`Base Year: ${research.baseYear}`)
  lines.push(`Forecast Period: ${research.forecastStart} - ${research.forecastEnd}`)
  if (research.keyPlayers.length > 0) lines.push(`Key Players: ${research.keyPlayers.join(", ")}`)

  if (research.rawMarketData) {
    lines.push(`\n--- RAW MARKET SIZE, FORECAST, REVENUE & FINANCIAL DATA (USE EVERY SPECIFIC NUMBER YOU FIND HERE) ---\n${research.rawMarketData.substring(0, 7000)}`)
  }
  if (research.rawCompetitive) {
    lines.push(`\n--- RAW COMPETITIVE LANDSCAPE, COMPANY REVENUE, MARKET SHARE DATA (USE COMPANY-SPECIFIC REVENUE AND SHARE DATA) ---\n${research.rawCompetitive.substring(0, 6000)}`)
  }
  if (research.rawSegments) {
    lines.push(`\n--- RAW SEGMENTATION & REGIONAL SHARE DATA (USE EXACT SEGMENT PERCENTAGES AND REGIONAL BREAKDOWNS) ---\n${research.rawSegments.substring(0, 6000)}`)
  }
  if (research.rawEvents) {
    lines.push(`\n--- RAW EVENTS, NEWS, DEALS, FUNDING, PARTNERSHIPS, STATISTICS & INDUSTRY DATA (USE DATES, AMOUNTS, COMPANY NAMES) ---\n${research.rawEvents.substring(0, 7000)}`)
  }
  if (research.rawRegulatory) {
    lines.push(`\n--- RAW REGULATORY, FDA/EMA APPROVALS, GOVERNMENT POLICIES, STANDARDS, COMPLIANCE & LEGAL CHANGES (USE THESE FOR THE CURRENT EVENTS TABLE — every row must reference a specific regulation, approval, policy change, or legal event with its official name, date, and enforcing body) ---\n${research.rawRegulatory.substring(0, 6000)}`)
  }

  return lines.join("\n")
}

const REQUIRED_REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"]
const MIN_REGION_SHARE = 2.0

function fixRegionalShares(chartData: ReportChartData): ReportChartData {
  if (!chartData.regionalShare || chartData.regionalShare.length === 0) return chartData

  const existing = new Map(chartData.regionalShare.map((r) => [r.region, r.share]))

  for (const region of REQUIRED_REGIONS) {
    if (!existing.has(region)) existing.set(region, 0)
  }

  const belowMin = [...existing.entries()].filter(([, share]) => share < MIN_REGION_SHARE)

  if (belowMin.length > 0) {
    const deficit = belowMin.reduce((sum, [, share]) => sum + (MIN_REGION_SHARE - share), 0)
    const aboveMin = [...existing.entries()].filter(([, share]) => share >= MIN_REGION_SHARE)
    const aboveTotal = aboveMin.reduce((sum, [, share]) => sum + share, 0)

    for (const [region] of belowMin) {
      existing.set(region, MIN_REGION_SHARE)
    }

    for (const [region, share] of aboveMin) {
      const proportion = share / aboveTotal
      const reduction = deficit * proportion
      existing.set(region, Math.round((share - reduction) * 10) / 10)
    }
  }

  const total = [...existing.values()].reduce((a, b) => a + b, 0)
  const result: { region: string; share: number }[] = []
  let runningTotal = 0
  const entries = [...existing.entries()].sort((a, b) => a[1] - b[1])

  for (let i = 0; i < entries.length; i++) {
    const [region, share] = entries[i]
    if (i === entries.length - 1) {
      result.push({ region, share: Math.round((100 - runningTotal) * 10) / 10 })
    } else {
      const normalized = Math.round((share / total * 100) * 10) / 10
      result.push({ region, share: normalized })
      runningTotal += normalized
    }
  }

  console.log("[AI Report] Regional shares fixed:", result.map((r) => `${r.region}: ${r.share}%`).join(", "))
  return { ...chartData, regionalShare: result }
}

function buildSystemPrompt(exampleHTML: string, researchBlock: string): string {
  return `You are a senior market research analyst at Coherent Market Insights (CMI). You produce comprehensive, publication-ready market research reports in HTML, matching CMI's exact page structure and content depth.

OUTPUT: RAW HTML ONLY. No markdown. No code fences. No \`\`\`html. Start directly with the first HTML tag.

${exampleHTML ? `=== REAL CMI REPORT HTML (use ONLY for inline-style and CSS-class reference — tables, <p style="text-align: justify;">, <strong>, .marketReptable, .tblcolBG, etc.) ===\n${exampleHTML.substring(0, 6000)}\n=== END EXAMPLE HTML ===` : ""}

=== VERIFIED RESEARCH DATA (ground your report in this data — do NOT fabricate numbers) ===
${researchBlock}
=== END RESEARCH DATA ===

YOU MUST PRODUCE ALL OF THE FOLLOWING SECTIONS, IN THIS EXACT ORDER. Each section MUST be present and substantial.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: MARKET SIZE & FORECAST PARAGRAPH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<p style="text-align: justify;">The global {Market Name} is estimated to be valued at <strong>{USD X.X Mn/Bn}</strong> in 2026 and is expected to reach <strong>{USD Y.Y Mn/Bn}</strong> by 2033, exhibiting a compound annual growth rate <strong>(CAGR) of {Z.Z}%</strong> from 2026 to 2033. {2-3 sentences of growth context}.</p>
IMPORTANT: The current year is 2026. Show the market size for 2026 (not 2025). Base year is 2025. Forecast period is 2026-2033. Historical data is 2020-2024.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: KEY TAKEAWAYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Key Takeaways of the Global {Market}</h3>
<ul style="text-align: justify;">
  <li>{Leading segment} segment is expected to lead... capturing <strong>XX.X%</strong> share in 2026.</li>
  <li>{Second segment} segment is estimated to represent <strong>XX.X%</strong>...</li>
  <li>{Third segment} segment is projected to dominate with <strong>XX.X%</strong>...</li>
  <li><strong>North America</strong> is expected to lead the market, holding <strong>XX.X%</strong> in 2026. <strong>Asia Pacific</strong> is anticipated to be the fastest-growing region, with <strong>XX.X%</strong> share.</li>
</ul>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: MARKET OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Market Overview</h3>
<ul style="text-align: justify;">
  <li>4-5 bullet points. Each bullet MUST cite a specific stat, date, or named data source. Example: "According to {Source}, {specific number or finding}. This has led to {consequence with another number}."</li>
</ul>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: CURRENT EVENTS AND THEIR IMPACT (TABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Current Events and their Impact</h3>
<div class="table-responsive">
<table class="table table-bordered marketReptableinfo">
<thead><tr>
<th class="table-primary tblcolBG" style="width:35%"><strong>Current Events</strong></th>
<th class="table-primary tblcolBG"><strong>Description and its Impact</strong></th>
</tr></thead>
<tbody>
{4-6 rows, each row MUST be one of these event types that is SPECIFIC to this exact market:}

ROW TYPES (pick 4-6 from the research data, prioritizing regulatory/policy):
1. REGULATORY APPROVAL — e.g., "FDA approved {specific product} under {pathway} on {date}" or "EMA granted marketing authorization for {product} on {date}"
2. GOVERNMENT POLICY / LAW CHANGE — e.g., "The {country} enacted {Act Name / Policy Name} on {date}, mandating {specific requirement}" or "New tariff/subsidy/ban announced by {body}"
3. STANDARDS / COMPLIANCE UPDATE — e.g., "ISO/IEC released {standard number} for {topic} in {month year}" or "GMP guidelines updated by {regulatory body}"
4. MAJOR ACQUISITION / MERGER — e.g., "On {date}, {Company A} acquired {Company B} for USD {amount}" 
5. CLINICAL TRIAL / PRODUCT LAUNCH — e.g., "{Company} reported Phase {X} results for {product} showing {specific outcome}" or "{Company} launched {product} in {region} on {date}"
6. GOVERNMENT FUNDING / GRANT — e.g., "{Agency} allocated USD {amount} for {purpose} under {program name} in {year}"

<tr><td><strong>{Specific Event Title — include the official name of the regulation/product/policy}</strong></td><td><strong>Description</strong>: On {exact date, month year}, {specific body/company} {specific action with official names, numbers, and amounts}. This {regulation/product/policy} specifically targets {what aspect of this market}. <strong>Impact</strong>: This directly affects the {market} by {quantified impact — e.g., "expected to increase adoption by X%", "opens a USD X Bn addressable market", "reduces compliance cost by X%", "restricts X% of current supply"}.</td></tr>
</tbody>
</table>
</div>
CRITICAL FOR THIS SECTION: 
- Every row MUST be specific to THIS market — not generic industry trends. If the report is about "cell therapy manufacturing platforms", events must be about cell therapy manufacturing regulations, not general pharma news.
- Use ONLY events found in the RAW REGULATORY and RAW EVENTS research data.
- Each event MUST name the specific regulation, act, product, or policy by its official name.
- Each impact MUST quantify the effect on this specific market (dollar amount, percentage change, number of companies affected, timeline).
- Include the date (at minimum month and year) and the issuing body (FDA, EMA, NMPA, Congress, European Commission, etc.) for every regulatory event.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: SEGMENTAL INSIGHTS (2-3 subsections)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each major segmentation dimension (e.g., By Type, By Technology, By Application):
<h3 style="text-align: justify;">Why Does the {Segment} Dominate the Global {Market} in 2026?</h3>
<p style="text-align: justify;">{Detailed 2-3 paragraph analysis explaining WHY this segment leads. MUST include:
- Exact market share percentage in bold (e.g., "accounted for <strong>42.3%</strong> of the total revenue in 2025")
- Dollar-value of this segment (e.g., "valued at <strong>USD 1.78 billion</strong> in 2026")
- Technical explanation grounded in industry data (e.g., "Due to a 67% reduction in cost-per-unit since 2020, driven by...")
- Real company example with date, deal size, and source (e.g., "In March 2025, Thermo Fisher invested USD 200 million in expanding its single-use bioreactor facility in Singapore (Source: Company SEC Filing)")
- Growth comparison (e.g., "growing at a CAGR of 15.2% vs. 9.8% for the nearest competing segment")}</p>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6: REGIONAL INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Regional Insights</h3>

<h4 style="text-align: justify;">North America {Market} Analysis and Trends</h4>
<p style="text-align: justify;">{2-3 paragraphs. MUST include: (1) exact share % in bold, (2) USD value of the regional market, (3) number of facilities/companies/patents/approvals in the region, (4) specific government policy or funding program with name and amount, (5) named company headquarters and regional revenue if available}</p>

<h4 style="text-align: justify;">Asia Pacific {Market} Analysis and Trends</h4>
<p style="text-align: justify;">{2-3 paragraphs as fastest-growing. MUST include: (1) exact share% and growth rate, (2) country-level breakdown (China X%, India Y%, Japan Z%), (3) specific government initiative (e.g., "China's 14th Five-Year Plan allocated USD X billion to..."), (4) named company expansion with investment amount}</p>

<h4 style="text-align: justify;">{Market} Outlook for Key Countries</h4>
Then 3-4 country subsections with country-specific data:
<h4 style="text-align: justify;">How is the U.S. Helping in the Growth of the {Market}?</h4>
<p style="text-align: justify;">{1-2 paragraphs with: (1) number of companies operating in this market in the U.S., (2) specific FDA/regulatory data with counts and dates, (3) government funding amount and program name, (4) named university/research institution and their contribution}</p>
<h4 style="text-align: justify;">How is China Helping in the Growth of the {Market}?</h4>
<p style="text-align: justify;">{1-2 paragraphs with China-specific data, NMPA approvals, investment figures}</p>
(Repeat for Germany, Japan, or other relevant countries)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7: CHALLENGES / RESTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">{Major Challenge Title}</h3>
<ul style="text-align: justify;">
<li>{2-3 detailed bullet points. Each MUST include a specific cost figure, failure rate, or regulatory barrier with data. Example: "Manufacturing costs for autologous therapies average USD 300,000–500,000 per patient dose (Source: Alliance for Regenerative Medicine 2025 Report), making..."}</li>
</ul>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8: MARKET PLAYERS, KEY DEVELOPMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Market Players, Key Developments, and Competitive Intelligence</h3>
<h4 style="text-align: justify;">Key Developments</h4>
<ul style="text-align: justify;">
<li>On {Date}, {Company} {action — partnership/launch/acquisition/funding}. {2-3 sentences of detail}.</li>
(3-4 real developments from the research data)
</ul>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9: TOP STRATEGIES TABLE (by player tier)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h4 style="text-align: justify;">Top Strategies Followed by Global {Market} Players</h4>
<div class="table-responsive">
<table class="table table-bordered marketReptableinfo">
<thead><tr>
<th class="table-primary tblcolBG" style="width:20%"><strong>Player Type</strong></th>
<th class="table-primary tblcolBG" style="width:40%"><strong>Strategic Focus</strong></th>
<th class="table-primary tblcolBG" style="width:40%"><strong>Examples</strong></th>
</tr></thead>
<tbody>
<tr><td><strong>Established Market Leaders</strong></td><td>{Strategy description}</td><td>{Real example with date}</td></tr>
<tr><td><strong>Mid-Level Players</strong></td><td>{Strategy description}</td><td>{Real example}</td></tr>
<tr><td><strong>Small-Scale Players</strong></td><td>{Strategy description}</td><td>{Real example}</td></tr>
</tbody>
</table>
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 10: REPORT COVERAGE TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<div class="marketReptable">
<div class="market_tabhead text-center"><h4>Global {Market} Report Coverage</h4></div>
<div class="table-responsive">
<table class="table table-bordered marketReptableinfo">
<tbody>
<tr><th class="table-primary tblcolBG tblcolBGtblh w-25">Report Coverage</th><th class="table-primary tblcolBG tblcolBGtblh text-center" colspan="3">Details</th></tr>
<tr><td class="table-primary tblcolBG tblcolBG1 w-25">Base Year:</td><td>{BaseYear}</td><th class="table-primary tblcolBG tblcolBG1 w-25">Market Size in {ForecastStart}:</th><td>{MarketSize}</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG2 w-25">Historical Data for:</td><td>{HistStart} To {HistEnd}</td><td class="table-primary tblcolBG tblcolBG2 w-25">Forecast Period:</td><td>{ForecastStart} To {ForecastEnd}</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG1 w-25">Forecast Period {ForecastStart} to {ForecastEnd} CAGR:</td><td><strong>{CAGR}%</strong></td><td class="table-primary tblcolBG tblcolBG1 w-25">{ForecastEnd} Value Projection:</td><td>{ProjectedSize}</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG2 w-25">Geographies covered:</td><td colspan="3"><strong>North America:</strong> U.S. and Canada <strong>Latin America:</strong> Brazil, Argentina, Mexico, Rest of Latin America <strong>Europe:</strong> Germany, U.K., Spain, France, Italy, Russia, Rest of Europe <strong>Asia Pacific:</strong> China, India, Japan, Australia, South Korea, ASEAN, Rest of Asia Pacific <strong>Middle East:</strong> GCC Countries, Israel, Rest of Middle East <strong>Africa:</strong> South Africa, North Africa, Central Africa</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG1 w-25">Segments covered:</td><td colspan="3">{List all segmentation dimensions with their values}</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG2 w-25">Companies covered:</td><td colspan="3">{List 10-15 key companies}</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG1 w-25">Growth Drivers:</td><td colspan="3">{2-3 key drivers}</td></tr>
<tr><td class="table-primary tblcolBG tblcolBG2 w-25">Restraints & Challenges:</td><td colspan="3">{2-3 key restraints}</td></tr>
</tbody>
</table>
</div>
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 11: MARKET DYNAMICS (Drivers & Opportunities with full paragraphs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Global {Market} Market Driver - {Driver Title}</h3>
<p style="text-align: justify;">{2-3 paragraphs. Each paragraph MUST include: (1) a specific dollar or percentage stat in bold, (2) a named data source, (3) a real-world company example with date and deal value. Example: "According to the Alliance for Regenerative Medicine (ARM), global cell & gene therapy funding reached <strong>USD 19.2 billion</strong> in 2025, a 12% increase from 2024. In July 2025, Novartis expanded its Kymriah manufacturing capacity with a <strong>USD 300 million</strong> investment in a new facility in Morris Plains, NJ."}</p>

<h3 style="text-align: justify;">Global {Market} Market Opportunity - {Opportunity Title}</h3>
<p style="text-align: justify;">{2-3 paragraphs with same data density — emerging applications, untapped regions, new patient populations, pipeline counts}</p>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 12: ANALYST OPINION (EXPERT OPINION) — THIS MUST BE THE MOST OPINIONATED AND DETAILED SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Expert Opinion</h3>

THIS IS NOT A SUMMARY. This is a SENIOR ANALYST'S PERSONAL, OPINIONATED TAKE on the market. Write it as though a veteran analyst with 20+ years of domain expertise is giving their unfiltered assessment to a boardroom of C-suite executives. The tone must be confident, decisive, and occasionally contrarian.

You MUST produce ALL 5 of the following sub-sections under the Expert Opinion heading. Each must be a full paragraph (4-6 sentences minimum), not bullet points.

<h4 style="text-align: justify;">Investment Verdict</h4>
<p style="text-align: justify;">{Open with a CLEAR directional call — e.g., "This market is unequivocally a BUY for long-horizon institutional investors" or "We see this market as OVERVALUED relative to near-term fundamentals." State the specific 3-year and 5-year return thesis. Name the TOP 2-3 companies that are best positioned and WHY (cite their revenue, margins, pipeline strength, or moat). Name 1-2 companies that are OVERRATED and WHY. Include a specific price/valuation benchmark — e.g., "At current implied valuations of X.X times forward revenue, the sector trades at a 20% premium to the 5-year median, but this is justified by..." End with a conviction-level rating: High Conviction / Moderate Conviction / Speculative.}</p>

<h4 style="text-align: justify;">What the Market Is Getting Wrong</h4>
<p style="text-align: justify;">{Identify 2-3 specific consensus assumptions that you believe are INCORRECT or overly optimistic/pessimistic. For each, explain: (1) what the consensus view is, (2) what the data actually shows (with specific numbers from the research), (3) why the consensus is misreading the signal. Example: "The consensus expectation of 15% CAGR assumes sustained government subsidies, but the U.S. Inflation Reduction Act Section 45X credits are set to phase down by 30% starting 2028, which most models have not priced in. Meanwhile, Europe's CBAM implementation will add 8-12% to input costs for non-EU manufacturers by 2027." Be specific and contrarian.}</p>

<h4 style="text-align: justify;">Structural Tailwinds vs. Headwinds — Where the Real Risk Lies</h4>
<p style="text-align: justify;">{Rank the top 3 tailwinds and top 3 headwinds BY IMPACT MAGNITUDE (not generic categories). For each, assign a specific impact estimate — e.g., "Tailwind #1: Regulatory fast-tracking (estimated to compress time-to-market by 18 months, worth USD X Bn in accelerated revenue by 2030)." For headwinds, quantify the downside scenario — e.g., "If raw material costs increase by the 25% that current commodity futures imply, margins for mid-tier players will compress from 22% to 14%, forcing consolidation." End by stating which risk you believe is MOST UNDERPRICED by the market.}</p>

<h4 style="text-align: justify;">Inflection Points to Watch (Next 12-18 Months)</h4>
<p style="text-align: justify;">{Name 3-4 SPECIFIC upcoming events or milestones that will materially shift the market trajectory. Each must have a DATE or TIMEFRAME, a NAMED entity (company, regulator, or body), and QUANTIFIED impact. Examples: "Q3 2026: FDA advisory committee review for {Product X} — approval would unlock a USD X Bn addressable market overnight", "January 2027: EU CSRD reporting requirements take effect for mid-cap companies, expected to drive X% increase in demand for {relevant product/service}", "H2 2026: {Company}'s new manufacturing facility in {location} comes online, adding X% to global production capacity." These must be FORWARD-LOOKING and actionable, not historical events.}</p>

<h4 style="text-align: justify;">Bottom Line</h4>
<p style="text-align: justify;">{A single, decisive paragraph that synthesizes the above into an actionable thesis. State clearly: (1) whether this market will OUTPERFORM, MATCH, or UNDERPERFORM the broader sector over the next 3-5 years, (2) the single biggest catalyst that could accelerate growth beyond current projections, (3) the single biggest risk that could derail the thesis, (4) the ideal positioning strategy — e.g., "Investors should overweight pure-play leaders like {Company A} and {Company B}, while avoiding conglomerates with sub-scale exposure like {Company C} whose {market} division represents less than 8% of total revenue." End with a memorable, quotable one-liner that captures the analyst's conviction.}</p>

CRITICAL RULES FOR EXPERT OPINION:
- NO hedging language like "may", "could potentially", "it remains to be seen". Use "will", "is likely to", "we expect", "the data clearly shows".
- NO generic statements like "the market shows promising growth" or "stakeholders should monitor developments". Every sentence must contain a specific data point, company name, or quantified projection.
- TAKE SIDES. If two technologies are competing, pick the winner and explain why. If a region is overhyped, say so. If a company is poorly managed, call it out.
- This section should be AT LEAST 800 words. It is the crown jewel of the report and the primary reason executives pay for premium research.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 13: MARKET SEGMENTATION TREE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Market Segmentation</h3>
<ul style="text-align: justify;">
<li><strong>{Dimension 1} Insights (Revenue, USD Mn/Bn, {HistStart} - {ForecastEnd})</strong>
  <ul><li>{Segment A}</li><li>{Segment B}</li><li>{Segment C}</li></ul>
</li>
<li><strong>{Dimension 2} Insights (Revenue, USD Mn/Bn, {HistStart} - {ForecastEnd})</strong>
  <ul><li>...</li></ul>
</li>
<li><strong>Regional Insights (Revenue, USD Mn/Bn, {HistStart} - {ForecastEnd})</strong>
  <ul>
    <li>North America<ul><li>U.S.</li><li>Canada</li></ul></li>
    <li>Europe<ul><li>Germany</li><li>U.K.</li><li>France</li><li>Rest of Europe</li></ul></li>
    <li>Asia Pacific<ul><li>China</li><li>India</li><li>Japan</li><li>Rest of Asia Pacific</li></ul></li>
    <li>Latin America<ul><li>Brazil</li><li>Mexico</li><li>Rest of Latin America</li></ul></li>
    <li>Middle East & Africa<ul><li>GCC Countries</li><li>South Africa</li><li>Rest of MEA</li></ul></li>
  </ul>
</li>
</ul>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 14: FAQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<h3 style="text-align: justify;">Frequently Asked Questions</h3>
<div class="faq-section">
<div class="faq-item"><h4 style="text-align: justify;">How big is the global {market}?</h4><p style="text-align: justify;">{Answer with numbers}</p></div>
<div class="faq-item"><h4 style="text-align: justify;">What will be the CAGR of the global {market}?</h4><p style="text-align: justify;">{Answer}</p></div>
<div class="faq-item"><h4 style="text-align: justify;">What are the major factors driving the global {market} growth?</h4><p style="text-align: justify;">{Answer}</p></div>
<div class="faq-item"><h4 style="text-align: justify;">What are the key factors hampering growth of the global {market}?</h4><p style="text-align: justify;">{Answer}</p></div>
<div class="faq-item"><h4 style="text-align: justify;">Which is the leading {main segment dimension} in the global {market}?</h4><p style="text-align: justify;">{Answer}</p></div>
<div class="faq-item"><h4 style="text-align: justify;">Which recent company developments are shaping this market?</h4><p style="text-align: justify;">{Answer}</p></div>
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AFTER ALL HTML SECTIONS, on a new line, output this JSON block for interactive charts:
---CHART_DATA---
{
  "regionalShare": [{"region": "North America", "share": XX.X}, {"region": "Europe", "share": XX.X}, {"region": "Asia Pacific", "share": XX.X}, {"region": "Latin America", "share": X.X}, {"region": "Middle East & Africa", "share": X.X}],
  "segmentShare": [{"segment": "{Seg1}", "share": XX}, {"segment": "{Seg2}", "share": XX}, {"segment": "{Seg3}", "share": XX}],
  "marketGrowth": [{"year": "2026", "value": XX.X}, ... one entry per year through 2033],
  "metadata": {"marketSize": "{size in 2026}", "marketSizeProjected": "{projected}", "cagr": "X.X", "forecastEnd": "2033", "unit": "Mn or Bn"}
}
---END_CHART_DATA---
IMPORTANT: All 5 regions MUST be present in regionalShare and EVERY share must be >= 2.0. They must sum to exactly 100.

CRITICAL RULES:
- The CURRENT YEAR is 2026. Always show market size for 2026 (not 2025). Base Year = 2025. Forecast Period = 2026 to 2033. Historical Data = 2020 to 2024.
- If research data shows 2025 figures, apply 1 year of CAGR growth to get 2026 values.
- ALL text paragraphs MUST use style="text-align: justify;"
- Bold all key numbers with <strong>
- Regional shares MUST sum to 100%. EVERY region MUST have a meaningful share — no region below 2%. Typical realistic distribution: North America 30-45%, Europe 18-28%, Asia Pacific 22-35%, Latin America 4-8%, Middle East & Africa 3-6%. Adjust based on actual market data but NEVER set any region to 0 or below 2%.
- Segment shares MUST sum to 100%
- Market growth follows compound formula: value[n] = base × (1 + CAGR/100)^n
- Tables use classes: "table table-bordered marketReptableinfo" and "table-primary tblcolBG"
- Produce SUBSTANTIAL content — minimum 15,000 characters of HTML. Every section must be thorough
- Do NOT include any <img> tags or image references
- Do NOT use markdown. Pure HTML only

=== DATA-RICHNESS MANDATE (THIS IS THE MOST IMPORTANT RULE) ===
Every single paragraph MUST contain AT LEAST ONE of:
  (a) A specific dollar figure (e.g., "USD 257 million Series D round", "USD 380 million global manufacturing agreement")
  (b) A specific percentage (e.g., "68.2% market share", "grew 23% year-over-year")
  (c) A specific date + company name + action (e.g., "On February 3, 2026, Cellares announced...")
  (d) A specific statistic from a named source (e.g., "According to FDA, over 1,100 GMP entries...")
  (e) A specific unit count (e.g., "approximately 6,701 ASCs in the U.S.", "49 ATMP marketing authorization applications")

DO NOT write generic sentences like "The market is growing due to increasing demand." Instead write: "The market grew from USD X.X Bn in 2024 to USD Y.Y Bn in 2025, driven by a 23% year-over-year increase in FDA approvals for cell-based therapies, which reached 31 approved ATMPs as of November 2025 (Source: EMA Committee for Advanced Therapies)."

For EVERY company mentioned, include: (1) what they did, (2) when (month/year), (3) the dollar value or scope of the action, (4) the source name in parentheses.

For EVERY market statistic, cite the source: "(Source: Grand View Research)", "(Source: FDA)", "(Source: WHO)", etc.

If the research data contains a specific number, USE IT. Never round or generalize what the research already provides in specific form.
=== END DATA-RICHNESS MANDATE ===`
}

export const maxDuration = 300

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { query: marketQuery } = await request.json()

  if (!marketQuery || marketQuery.length < 2) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
  }

  const marketName = marketQuery.trim().replace(/\bmarket\b/i, "").trim()
  const fullName = `${marketName} Market`

  try {
    console.log(`[AI Report] Starting generation for: "${fullName}"`)

    // Phase 1: Tavily Research (5 parallel queries)
    console.log("[AI Report] Phase 1: Researching with Tavily...")
    const research = await researchMarket(fullName)
    const contextLen = research.rawMarketData.length + research.rawCompetitive.length + research.rawSegments.length + research.rawEvents.length + research.rawRegulatory.length
    console.log(`[AI Report] Research complete. Context: ${contextLen} chars, Players: ${research.keyPlayers.length}`)

    // Phase 2: Get DB example for HTML structure reference
    console.log("[AI Report] Phase 2: Fetching DB template...")
    const exampleSummary = await getExampleSummary()
    console.log(`[AI Report] Template: ${exampleSummary.length} chars`)

    // Phase 3: Build prompt and generate
    console.log("[AI Report] Phase 3: Generating comprehensive report with OpenAI...")
    const researchBlock = buildResearchBlock(research)
    const systemPrompt = buildSystemPrompt(exampleSummary, researchBlock)

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a COMPLETE and COMPREHENSIVE market research report for: "Global ${fullName} Size and Share Analysis - Growth Trends and Forecasts (${research.forecastStart} - ${research.forecastEnd})"

Include ALL 14 sections as specified. Output raw HTML only. Every section must be thorough and substantial.

CRITICAL: This report must read like a premium analyst publication. Every single paragraph MUST contain at least one specific data point — a dollar figure, a percentage, a date+company+action, a named source, or a count. DO NOT write any sentence that is merely qualitative (e.g., "the market is growing" or "demand is increasing"). Instead, every claim must be backed by a stat from the research data. If the research data provides a number, use the EXACT number — do not round or generalize.

Use ALL the verified Tavily research data provided. Extract every number, company name, date, deal value, regulatory count, and named source from the research context and weave them into the report.`,
          },
        ],
        temperature: 0.25,
        max_tokens: 16000,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[AI Report] OpenAI error:", err)
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 })
    }

    const data = await res.json()
    let content = data.choices?.[0]?.message?.content || ""

    content = content.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim()

    // Phase 4: Extract chart data
    console.log("[AI Report] Phase 4: Extracting chart data...")
    let chartData: ReportChartData | null = null

    const chartMatch = content.match(/---CHART_DATA---([\s\S]*?)---END_CHART_DATA---/)
    if (chartMatch) {
      try {
        chartData = JSON.parse(chartMatch[1].trim())
        console.log("[AI Report] Chart data extracted from AI JSON")
      } catch {
        console.warn("[AI Report] Failed to parse chart JSON, falling back to HTML extraction")
      }
      content = content.replace(/---CHART_DATA---[\s\S]*?---END_CHART_DATA---/, "").trim()
    }

    if (!chartData) {
      chartData = extractChartData(content)
      console.log(`[AI Report] Chart data from HTML extraction: ${chartData ? "yes" : "no"}`)
    }

    // Phase 5: Validate and fix chart data
    if (chartData) {
      chartData = fixRegionalShares(chartData)
    }

    if (!content.startsWith("<")) {
      const idx = content.indexOf("<")
      if (idx > -1) content = content.substring(idx)
    }

    const forecastPeriod = `${research.forecastStart} - ${research.forecastEnd}`
    const usage = data.usage
    console.log(`[AI Report] Done. HTML: ${content.length} chars, Charts: ${chartData ? "yes" : "no"}, Tokens: ${usage?.total_tokens || "?"}`)

    return NextResponse.json({
      report: {
        keyword: `Global ${fullName}`,
        newssubject: `Global ${fullName} Size and Share Analysis - Growth Trends and Forecasts (${forecastPeriod})`,
        forcastyear: forecastPeriod,
        summary: content,
        reportstatus: null,
        catid: null,
        no_pages: null,
        price_sul: 0,
        price_cul: 0,
        price_multi: 0,
        ai_generated: true,
      },
      sections: [],
      chartData,
      sources: research.sources,
    })
  } catch (error) {
    console.error("[AI Report] Generation error:", error)
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 })
  }
}
