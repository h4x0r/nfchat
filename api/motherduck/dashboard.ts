/**
 * Vercel API Route: POST /api/motherduck/dashboard
 *
 * Get all dashboard data in a single call.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleGetDashboardData } from '../../src/api/routes/motherduck'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { bucketMinutes, whereClause, limit, offset } = req.body || {}

    const result = await handleGetDashboardData({
      bucketMinutes: bucketMinutes || 60,
      whereClause: whereClause || '1=1',
      limit: limit || 1000,
      offset: offset || 0,
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('MotherDuck dashboard error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
