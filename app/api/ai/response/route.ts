import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export const maxDuration = 120

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prompt } = await request.json()

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      response:
        "<p>AI response will be available once the OpenAI API key is configured.</p>",
    })
  }

  try {
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
              "You are a market research assistant for Coherent Market Insights. Answer in 100 words or fewer with 3-4 major points. Format with HTML tags.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
    })

    const data = await res.json()
    const content =
      data.choices?.[0]?.message?.content || "<p>Unable to generate response.</p>"

    return NextResponse.json({ response: content })
  } catch (error) {
    console.error("AI response error:", error)
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}
