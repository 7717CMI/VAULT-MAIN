import { NextResponse } from "next/server"
import { testConnection } from "@/lib/s3"

export async function GET() {
  try {
    const result = await testConnection()
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
