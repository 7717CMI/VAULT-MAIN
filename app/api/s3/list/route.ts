import { NextResponse } from "next/server"
import { listObjects } from "@/lib/s3"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const prefix = searchParams.get("prefix") || undefined
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100)

  try {
    const objects = await listObjects(prefix)
    return NextResponse.json({
      success: true,
      count: objects.length,
      objects: objects.slice(0, limit).map((o) => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified?.toISOString(),
      })),
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
