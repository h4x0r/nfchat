/**
 * Vercel API Route: POST /api/motherduck/load
 *
 * Load parquet data from a URL into MotherDuck.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Dynamic import to catch module loading errors
    console.log('[API] Importing motherduck module...')
    const { handleLoadFromUrl } = await import('../../src/api/routes/motherduck')
    console.log('[API] Module imported successfully')

    const { url, tableName } = req.body || {}
    console.log('[API] Loading data from:', url)

    const result = await handleLoadFromUrl({
      url: url || '',
      tableName: tableName || 'flows',
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('MotherDuck load error:', errorMessage)
    console.error('Stack:', errorStack)
    return res.status(500).json({
      success: false,
      error: errorMessage,
      stack: process.env.NODE_ENV !== 'production' ? errorStack : undefined,
    })
  }
}
