import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import crypto from "crypto"

const SESSION_COOKIE = "iv_session"

function buildSessionResponse(data: { uid: number; name: string; email: string; urole: string }) {
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Hash password with MD5 (matching PHP implementation)
    const hashedPassword = crypto.createHash("md5").update(password).digest("hex")

    // Try database query if users table exists
    try {
      const result = await query(
        'SELECT userid, "Name", email, "Role" FROM "SubScribc_Users_new" WHERE email = $1 AND upass = $2',
        [email, hashedPassword]
      )

      if (result.rows.length > 0) {
        const user = result.rows[0]
        return buildSessionResponse({
          uid: user.userid,
          name: user.Name,
          email: user.email,
          urole: user.Role,
        })
      }
    } catch {
      // Users table doesn't exist yet — fall through to demo login
    }

    // Demo login (works regardless of DB state)
    const demoEmails = ["demo@insightvault.com", "demo@coherentmi.com"]
    if (demoEmails.includes(email) && password === "demo123") {
      return buildSessionResponse({
        uid: 1,
        name: "Demo User",
        email,
        urole: "subscriber",
      })
    }

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    )
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
