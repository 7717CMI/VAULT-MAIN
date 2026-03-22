import { NextResponse } from "next/server"
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
})

const BUCKET = process.env.AWS_S3_BUCKET || "cmiallreports"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit") || 10), 20)

  try {
    // List PDF objects
    const listCmd = new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 100 })
    const listRes = await s3Client.send(listCmd)
    const pdfObjects = (listRes.Contents || []).filter(
      (o) => o.Key && o.Key.endsWith(".pdf")
    )
    const toDownload = pdfObjects.slice(0, limit)

    const outDir = path.join(process.cwd(), "public", "pdffiles")
    await mkdir(outDir, { recursive: true })

    const results: { file: string; size: number; status: string }[] = []

    for (const obj of toDownload) {
      if (!obj.Key) continue
      const fileName = obj.Key.replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
      const filePath = path.join(outDir, fileName)

      try {
        const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key })
        const getRes = await s3Client.send(getCmd)
        const body = await getRes.Body?.transformToByteArray()

        if (body) {
          await writeFile(filePath, body)
          results.push({
            file: fileName,
            size: body.length,
            status: "downloaded",
          })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        results.push({ file: obj.Key, size: 0, status: `failed: ${msg}` })
      }
    }

    return NextResponse.json({
      success: true,
      downloaded: results.filter((r) => r.status === "downloaded").length,
      total: results.length,
      outputDir: "public/pdffiles/",
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
