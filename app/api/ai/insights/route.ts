import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export const maxDuration = 120

const INSIGHT_PROMPTS = [
  {
    title: "Growth Factors",
    prompt: (q: string) =>
      `List 3-4 major growth factors for the ${q} market in bullet points. Be concise.`,
    maxTokens: 200,
  },
  {
    title: "Market Trends",
    prompt: (q: string) =>
      `List 3 key market trends for the ${q} market. Be concise and specific.`,
    maxTokens: 200,
  },
  {
    title: "Key Opportunities",
    prompt: (q: string) =>
      `List 3 key business opportunities in the ${q} market. Be concise.`,
    maxTokens: 200,
  },
  {
    title: "Key Players",
    prompt: (q: string) =>
      `List 10-15 key companies/players in the ${q} market. Provide company names only in a bullet list.`,
    maxTokens: 200,
  },
  {
    title: "Geographical Analysis",
    prompt: (q: string) =>
      `Analyze the top geographical regions for the ${q} market. Cover North America, Europe, Asia Pacific, and Rest of World. Be concise.`,
    maxTokens: 300,
  },
  {
    title: "SWOT Analysis",
    prompt: (q: string) =>
      `Provide a brief SWOT analysis for the ${q} market. Cover Strengths, Weaknesses, Opportunities, and Threats with 2-3 points each.`,
    maxTokens: 420,
  },
  {
    title: "Potential Challenges",
    prompt: (q: string) =>
      `List 3 potential challenges for the ${q} market. Be concise.`,
    maxTokens: 150,
  },
  {
    title: "Market Segmentation",
    prompt: (q: string) =>
      `Describe 3-5 market segments for the ${q} market with subsegments. Be concise.`,
    maxTokens: 300,
  },
]

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { query: searchQuery } = await request.json()

  if (!searchQuery) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    // Return mock insights when no API key
    const mockSections = INSIGHT_PROMPTS.map((p) => ({
      title: p.title,
      content: `<p>AI insights for "${searchQuery}" will be available once the OpenAI API key is configured in your environment variables.</p><ul><li>Configure OPENAI_API_KEY in .env.local</li><li>Restart the development server</li><li>Search again to see AI-powered insights</li></ul>`,
    }))
    return NextResponse.json({ sections: mockSections })
  }

  try {
    const sections = await Promise.all(
      INSIGHT_PROMPTS.map(async (prompt) => {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a market research analyst for Coherent Market Insights. Provide concise, professional insights. Format responses with HTML tags for bullets (<ul><li>) and paragraphs (<p>).",
              },
              {
                role: "user",
                content: prompt.prompt(searchQuery),
              },
            ],
            max_tokens: prompt.maxTokens,
            temperature: 0.2,
          }),
        })

        const data = await res.json()
        const content =
          data.choices?.[0]?.message?.content || "<p>Unable to generate insights.</p>"

        return {
          title: prompt.title,
          content,
        }
      })
    )

    return NextResponse.json({ sections })
  } catch (error) {
    console.error("AI insights error:", error)
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    )
  }
}
