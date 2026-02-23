/**
 * Vercel API Route: POST /api/upload/cleanup
 *
 * Delete temporary files from R2 after loading completes.
 * Only allows deletion of files in the tmp/ prefix.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

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
    const { keys } = req.body || {}

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or empty keys array' })
    }

    const bucket = process.env.R2_BUCKET
    if (!bucket) {
      throw new Error('R2_BUCKET not configured')
    }

    const client = getS3Client()

    for (const key of keys) {
      if (typeof key !== 'string' || !key.startsWith('tmp/')) {
        return res.status(400).json({
          success: false,
          error: `Invalid key: ${key}. Keys must start with tmp/`,
        })
      }

      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }))

      console.log(`[Cleanup] Deleted ${key}`)
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Cleanup error:', errorMessage)
    return res.status(500).json({ success: false, error: errorMessage })
  }
}
