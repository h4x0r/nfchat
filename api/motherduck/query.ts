/**
 * Vercel API Route: POST /api/motherduck/query
 *
 * Execute a SQL query on MotherDuck.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleQuery } from '../../src/api/routes/motherduck'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { sql } = req.body || {}

    const result = await handleQuery({ sql: sql || '' })

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('MotherDuck query error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
