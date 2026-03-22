import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (process.env.DATABASE_URL) {
      const result = await query(
        `SELECT "Name", email FROM "SubScribc_Users_new" WHERE userid = $1`,
        [session.uid]
      )
      if (result.rows.length > 0) {
        return NextResponse.json({
          name: result.rows[0].Name,
          email: result.rows[0].email,
          contact: "",
        })
      }
    }
  } catch {
    // Fallback
  }

  return NextResponse.json({
    name: session.name,
    email: session.email,
    contact: "",
  })
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, email, contact } = await request.json()

  try {
    if (process.env.DATABASE_URL) {
      await query(
        `UPDATE "SubScribc_Users_new" SET "Name" = $1, email = $2 WHERE userid = $3`,
        [name, email, session.uid]
      )
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }

  // Mock response
  return NextResponse.json({ success: true })
}
