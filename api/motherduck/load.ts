/**
 * Vercel API Route: POST /api/motherduck/load
 *
 * Load parquet data from a URL into MotherDuck.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleLoadFromUrl } from '../../src/api/routes/motherduck'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { url, tableName } = req.body || {}

    const result = await handleLoadFromUrl({
      url: url || '',
      tableName: tableName || 'flows',
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('MotherDuck load error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
