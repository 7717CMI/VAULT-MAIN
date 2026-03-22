import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
})

const BUCKET = process.env.AWS_S3_BUCKET || "cmiallreports"

/**
 * List all objects in the S3 bucket (or with a prefix)
 */
export async function listObjects(prefix?: string) {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
    MaxKeys: 100,
  })
  const response = await s3Client.send(command)
  return response.Contents || []
}

/**
 * Search for a report PDF by title in the S3 bucket.
 * Uses fast prefix search (exact key match) first, then falls back to prefix scan.
 */
export async function findReportPdf(reportTitle: string): Promise<string | null> {
  const searchTitle = reportTitle.trim()

  // Fast path: try exact key match "{keyword}.pdf"
  try {
    const exactKey = `${searchTitle}.pdf`
    const headCmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: exactKey,
      MaxKeys: 1,
    })
    const headRes = await s3Client.send(headCmd)
    if (headRes.Contents && headRes.Contents.length > 0 && headRes.Contents[0].Key === exactKey) {
      return exactKey
    }
  } catch {
    // fall through to prefix search
  }

  // Prefix search: list objects starting with the keyword
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: searchTitle,
      MaxKeys: 10,
    })
    const response = await s3Client.send(command)
    const contents = response.Contents || []
    for (const obj of contents) {
      if (obj.Key && obj.Key.endsWith(".pdf")) {
        return obj.Key
      }
    }
  } catch {
    // no match
  }

  return null
}

/**
 * Generate a presigned URL for downloading a report PDF.
 * URL expires in 15 minutes.
 */
export async function getPresignedDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  })
  return getSignedUrl(s3Client, command, { expiresIn: 900 })
}

/**
 * Get all PDF keywords available in S3 (cached for 10 minutes).
 */
let pdfKeywordsCache: Set<string> | null = null
let pdfKeywordsCacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function getAvailablePdfKeywords(): Promise<Set<string>> {
  if (pdfKeywordsCache && Date.now() - pdfKeywordsCacheTime < CACHE_TTL) {
    return pdfKeywordsCache
  }

  const keywords = new Set<string>()
  let continuationToken: string | undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    })
    const response = await s3Client.send(command)
    for (const obj of response.Contents || []) {
      if (obj.Key && obj.Key.endsWith(".pdf")) {
        keywords.add(obj.Key.replace(".pdf", ""))
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  pdfKeywordsCache = keywords
  pdfKeywordsCacheTime = Date.now()
  return keywords
}

/**
 * Test S3 connectivity by listing up to 5 objects.
 */
export async function testConnection() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    MaxKeys: 5,
  })
  const response = await s3Client.send(command)
  return {
    success: true,
    bucket: BUCKET,
    region: process.env.AWS_REGION,
    objectCount: response.KeyCount || 0,
    objects: (response.Contents || []).map((o) => ({
      key: o.Key,
      size: o.Size,
      lastModified: o.LastModified?.toISOString(),
    })),
  }
}
