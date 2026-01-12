/**
 * Vercel API Route: POST /api/motherduck/load
 *
 * Load parquet data from a URL into MotherDuck.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadParquetData } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { url } = req.body || {}

    // Validate URL
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing URL' })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' })
    }

    // Require HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ success: false, error: 'URL must use HTTPS' })
    }

    console.log('[API] Loading parquet from:', url)
    const rowCount = await loadParquetData(url)

    return res.status(200).json({ success: true, rowCount })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('MotherDuck load error:', errorMessage)
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
