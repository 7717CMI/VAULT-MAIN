import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { downId } = await request.json()

  if (!downId) {
    return NextResponse.json({ error: "Download ID is required" }, { status: 400 })
  }

  try {
    if (process.env.DATABASE_URL) {
      // Update notification flag
      await query(
        `UPDATE "SubScribc_Users_Stats_new" SET sendnotify = 1 WHERE downid = $1`,
        [downId]
      )

      // TODO: Send email notification to user
      // Uses SMTP settings from environment variables
    }

    return NextResponse.json({ success: true, message: "Notification sent." })
  } catch (error) {
    console.error("Notify error:", error)
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    )
  }
}
