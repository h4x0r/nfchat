/**
 * Vercel API Route: POST /api/upload/presign
 *
 * Generate a presigned S3 PUT URL for uploading files to R2 tmp/ prefix.
 * Files uploaded here are ephemeral — deleted after loading, with a 1-hour
 * lifecycle rule as safety net.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const SUPPORTED_EXTENSIONS = ['.parquet', '.csv']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const PRESIGN_EXPIRY = 600 // 10 minutes

function getS3Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { filename } = req.body || {}

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing filename' })
    }

    // Validate extension
    const ext = '.' + filename.split('.').pop()?.toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      })
    }

    const bucket = process.env.R2_BUCKET
    const publicUrl = process.env.R2_PUBLIC_URL

    if (!bucket || !publicUrl) {
      throw new Error('R2_BUCKET or R2_PUBLIC_URL not configured')
    }

    // Generate unique key in tmp/ prefix
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `tmp/${Date.now()}-${randomUUID()}-${safeName}`

    const client = getS3Client()

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentLength: MAX_FILE_SIZE, // Max allowed size
    })

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRY,
    })

    return res.status(200).json({
      success: true,
      uploadUrl,
      publicUrl: `${publicUrl}/${key}`,
      key,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Presign error:', errorMessage)
    return res.status(500).json({ success: false, error: errorMessage })
  }
}
