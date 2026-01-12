/**
 * Vercel API Route: POST /api/motherduck/query
 *
 * Execute a SQL query on MotherDuck.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { executeQuery, convertBigInts } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { sql } = req.body || {}

    // Validate SQL
    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing SQL query' })
    }

    console.log('[API] Executing query:', sql.substring(0, 100))
    const data = await executeQuery(sql)

    return res.status(200).json({
      success: true,
      data: convertBigInts(data),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('MotherDuck query error:', errorMessage)
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
